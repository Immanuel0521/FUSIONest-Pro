export type MaterialCatalogItem = {
  name: string;
  unit: string;
  category: "Consumables & Materials" | "Machinery & Equipment" | "Tools & Instruments" | "PPE";
  specification?: string;
};

const catalog = (category: MaterialCatalogItem["category"], unit: string, names: string[]): MaterialCatalogItem[] =>
  names.map((name) => ({ name, unit, category }));

export const CONSUMABLE_MATERIALS: MaterialCatalogItem[] = [
  ...catalog("Consumables & Materials", "Pcs", ["MS Sections (as per drawing)", "Nozzle Gel"]),
  ...catalog("Consumables & Materials", "No.", ["AG4 Cutting Wheels – 4\"", "Grinding Wheels", "AG4 Diamond Cutting Wheel", "CO2 Gas Cylinders", "CO2 Gas Regulator", "Pop Rivets – 4.8 x 1/2\"", "Pop Rivets – 4.8 x 1\"", "Switch Boxes & Junction Boxes", "Clamps and Supports", "Solvent Cement / Jointing Material"]),
  ...catalog("Consumables & Materials", "Roll", ["MIG Wire Rolls", "Vapor Barrier / Moisture Membrane", "Double-Sided Tape", "PLEXUS Tape"]),
  ...catalog("Consumables & Materials", "Ltr", ["MS Primer Paint", "PU Paint", "Turpentine Oil", "Primer (Interior)", "Interior Emulsion Paint", "Exterior Primer", "Exterior Emulsion Paint"]),
  ...catalog("Consumables & Materials", "Rmt", ["GI C Channel – 0.8mm", "GI C Channel – 1.5mm", "Electrical Conduits", "Electrical Wires"]),
  ...catalog("Consumables & Materials", "Sheet", ["Plywood Sheets (for openings)", "External Boards – SHERA / RAMCO 12mm", "Internal Boards – SHERA / RAMCO 8mm/9mm"]),
  ...catalog("Consumables & Materials", "Set", ["Plumbing Pipes & Fittings"]),
  ...catalog("Consumables & Materials", "Bag", ["Rockwool Insulation", "Wall Putty"]),
  ...catalog("Consumables & Materials", "Tube", ["PU Chemical"]),
  ...catalog("Consumables & Materials", "Box", ["Self-Driven Screws"]),
  ...catalog("Consumables & Materials", "Kg", ["FORTIS Joint Component – Set A", "FORTIS Joint Component – Set B", "Exterior Texture Material"]),
];

export const DISPATCH_CHECKLIST: MaterialCatalogItem[] = [
  ...catalog("Machinery & Equipment", "No.", ["MIG Welding Machine", "AG4 Cutting Machine", "Chop-Saw Machine", "Air Compressor", "Spray Gun", "Marble Cutting Machine", "HILTI Drilling Machine", "Hydraulic Pressure Testing Machine", "Air Pressure Machine / Air Blower", "Self-Vacuuming Sanding Machine", "Mechanical Mixer", "Rivet Gun", "Punch Machine", "Electric Current Board"]),
  ...catalog("Machinery & Equipment", "Set", ["Scaffolding System (Sets)"]),
  ...catalog("Tools & Instruments", "No.", ["C-Clamps", "Measuring Tape (5m / 8m)", "Engineer's Square", "Spirit Level", "Hammer", "Rollers", "Brushes", "Cutting Plier", "Pipe Cutter", "Level Tube", "Sharp Blade", "Mixing Tray / Bucket", "Measuring Container", "Spatula / Putty Knife", "Margin Trowel", "Moisture Meter", "Light (Inspection)"]),
  ...catalog("Tools & Instruments", "Set", ["Markers (Set)", "Spanner Set", "Finishing Trowel & Blades", "Texture Tools", "Drill Bits (Set)", "Star Bits (Set)"]),
  ...catalog("Tools & Instruments", "Roll", ["Mason Line (Roll)"]),
  ...catalog("Tools & Instruments", "Sheet", ["Sandpaper (150 Grit)", "Sandpaper (180 Grit)", "Sandpaper (220 Grit)"]),
  ...CONSUMABLE_MATERIALS,
  ...catalog("PPE", "No.", ["Safety Helmet", "Welding Helmet", "Welding Suit / Apron", "Masks / Respirators", "Safety Goggles", "Safety Harness"]),
  ...catalog("PPE", "Pair", ["Safety Shoes (Pair)", "Welding Gloves (Pair)", "Normal Gloves (Pair)"]),
  ...catalog("PPE", "Set", ["Electrical Insulated Tools (Set)"]),
];

export const DISPATCH_SECTIONS: MaterialCatalogItem["category"][] = [
  "Machinery & Equipment",
  "Tools & Instruments",
  "Consumables & Materials",
  "PPE",
];