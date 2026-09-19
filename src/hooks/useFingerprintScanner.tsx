import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';

export interface FingerprintTemplate {
  templateData: string;
  qualityScore: number;
  fingerIndex: number;
}

export interface ScanResult {
  success: boolean;
  template?: FingerprintTemplate;
  error?: string;
}

export interface FingerprintScannerState {
  isConnected: boolean;
  isScanning: boolean;
  deviceInfo: string | null;
  lastError: string | null;
}

// USB Fingerprint Scanner Hook
// Supports common USB fingerprint scanners via WebUSB API or simulated mode
export function useFingerprintScanner() {
  const [state, setState] = useState<FingerprintScannerState>({
    isConnected: false,
    isScanning: false,
    deviceInfo: null,
    lastError: null,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceRef = useRef<any>(null);
  const scanResolverRef = useRef<((result: ScanResult) => void) | null>(null);

  // Check if WebUSB is supported
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isWebUSBSupported = typeof navigator !== 'undefined' && 'usb' in (navigator as any);

  // Connect to USB fingerprint scanner
  const connect = useCallback(async (): Promise<boolean> => {
    if (!isWebUSBSupported) {
      // Fallback to simulated mode for development/demo
      setState(prev => ({
        ...prev,
        isConnected: true,
        deviceInfo: 'Simulated Scanner (WebUSB not available)',
        lastError: null,
      }));
      toast.info('Using simulated fingerprint scanner for demo');
      return true;
    }

    try {
      // Request USB device - common fingerprint scanner vendors
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const usb = (navigator as any).usb;
      const device = await usb.requestDevice({
        filters: [
          { vendorId: 0x05ba }, // DigitalPersona
          { vendorId: 0x138a }, // Validity/Synaptics
          { vendorId: 0x0483 }, // STMicroelectronics (common in ZKTeco)
          { vendorId: 0x1c7a }, // LighTuning Technology
          { vendorId: 0x2808 }, // Futronic
          { vendorId: 0x0529 }, // Aladdin Knowledge Systems
        ],
      });

      await device.open();
      
      if (device.configuration === null) {
        await device.selectConfiguration(1);
      }

      await device.claimInterface(0);
      
      deviceRef.current = device;
      
      setState({
        isConnected: true,
        isScanning: false,
        deviceInfo: `${device.manufacturerName || 'Unknown'} - ${device.productName || 'Fingerprint Scanner'}`,
        lastError: null,
      });

      toast.success('Fingerprint scanner connected');
      return true;
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to connect to scanner';
      setState(prev => ({
        ...prev,
        isConnected: false,
        lastError: errorMsg,
      }));
      
      // If user cancelled, don't show error - offer simulation
      if (error.name === 'NotFoundError') {
        setState(prev => ({
          ...prev,
          isConnected: true,
          deviceInfo: 'Simulated Scanner Mode',
          lastError: null,
        }));
        toast.info('No scanner found - using simulation mode');
        return true;
      }
      
      toast.error(errorMsg);
      return false;
    }
  }, [isWebUSBSupported]);

  // Disconnect scanner
  const disconnect = useCallback(async () => {
    if (deviceRef.current) {
      try {
        await deviceRef.current.close();
      } catch (error) {
        console.error('Error closing device:', error);
      }
      deviceRef.current = null;
    }
    
    setState({
      isConnected: false,
      isScanning: false,
      deviceInfo: null,
      lastError: null,
    });
  }, []);

  // Capture fingerprint
  const capture = useCallback(async (fingerIndex: number = 1): Promise<ScanResult> => {
    if (!state.isConnected) {
      return { success: false, error: 'Scanner not connected' };
    }

    setState(prev => ({ ...prev, isScanning: true, lastError: null }));

    try {
      // If using real device
      if (deviceRef.current) {
        // Send capture command - this varies by device
        // Most scanners use control transfers or bulk transfers
        const result = await deviceRef.current.controlTransferOut({
          requestType: 'vendor',
          recipient: 'device',
          request: 0x01, // Capture command
          value: 0x00,
          index: 0x00,
        }, new Uint8Array([0x01])); // Start capture

        if (result.status !== 'ok') {
          throw new Error('Failed to initiate capture');
        }

        // Wait for capture to complete and read template
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Read the captured template
        const templateResult = await deviceRef.current.controlTransferIn({
          requestType: 'vendor',
          recipient: 'device',
          request: 0x02, // Read template command
          value: 0x00,
          index: 0x00,
        }, 2048);

        if (templateResult.status !== 'ok' || !templateResult.data) {
          throw new Error('Failed to read fingerprint template');
        }

        const templateBytes = new Uint8Array(templateResult.data.buffer);
        const templateData = btoa(String.fromCharCode(...templateBytes));
        
        // Extract quality score from template (device specific)
        const qualityScore = Math.min(100, Math.max(0, templateBytes[0] || 80));

        setState(prev => ({ ...prev, isScanning: false }));
        
        return {
          success: true,
          template: {
            templateData,
            qualityScore,
            fingerIndex,
          },
        };
      }

      // Simulated mode - generate demo template
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const simulatedTemplate = btoa(
        JSON.stringify({
          type: 'simulated',
          timestamp: Date.now(),
          fingerIndex,
          random: Math.random().toString(36).substring(7),
        })
      );

      setState(prev => ({ ...prev, isScanning: false }));
      
      return {
        success: true,
        template: {
          templateData: simulatedTemplate,
          qualityScore: Math.floor(Math.random() * 20) + 80, // 80-100
          fingerIndex,
        },
      };
    } catch (error: any) {
      const errorMsg = error.message || 'Capture failed';
      setState(prev => ({
        ...prev,
        isScanning: false,
        lastError: errorMsg,
      }));
      return { success: false, error: errorMsg };
    }
  }, [state.isConnected]);

  // Verify fingerprint against stored templates
  const verify = useCallback(async (
    capturedTemplate: string,
    storedTemplates: Array<{ workerId: string; templateData: string; workerName: string }>
  ): Promise<{ matched: boolean; workerId?: string; workerName?: string; confidence?: number }> => {
    // In real implementation, this would use SDK's matching algorithm
    // For demo, we simulate matching with stored templates
    
    for (const stored of storedTemplates) {
      // In production, use biometric SDK matching
      // For demo, simulate with template comparison
      const matchScore = simulateMatch(capturedTemplate, stored.templateData);
      
      if (matchScore > 0.7) { // 70% threshold
        return {
          matched: true,
          workerId: stored.workerId,
          workerName: stored.workerName,
          confidence: Math.round(matchScore * 100),
        };
      }
    }
    
    return { matched: false };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (deviceRef.current) {
        deviceRef.current.close().catch(() => {});
      }
    };
  }, []);

  return {
    ...state,
    isWebUSBSupported,
    connect,
    disconnect,
    capture,
    verify,
  };
}

// Simulated matching function (in production, use biometric SDK)
function simulateMatch(template1: string, template2: string): number {
  try {
    const decoded1 = JSON.parse(atob(template1));
    const decoded2 = JSON.parse(atob(template2));
    
    // Check if same simulated fingerprint
    if (decoded1.random === decoded2.random) {
      return 0.95 + Math.random() * 0.05;
    }
    
    // Check if same finger index
    if (decoded1.fingerIndex === decoded2.fingerIndex) {
      return 0.3 + Math.random() * 0.2;
    }
    
    return Math.random() * 0.3;
  } catch {
    // If not simulated templates, use character similarity
    const set1 = new Set(template1.split(''));
    const set2 = new Set(template2.split(''));
    const intersection = [...set1].filter(x => set2.has(x)).length;
    const union = new Set([...set1, ...set2]).size;
    return intersection / union;
  }
}
