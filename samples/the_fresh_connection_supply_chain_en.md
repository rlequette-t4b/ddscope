# The Fresh Connection Supply Chain — Standard Scenario — 2026-07-15

## Extraction notes

- Lead times, exact capacities, and batch sizes are not quantified in the general description as they depend on the specific game session configuration.
- The role of each VP is mentioned in the general description but is not modeled as a direct material flow.

**Project specific instructions:**
```
The industry sector is food & beverage.
```

**User:**
```
Create swim-lanes Source, Make, Deliver.
```

**User:**
```
Group lanes Source, Make, Deliver from left to right.
```

**User:**
```
Create product types "raw material", "packaging", "finished good".

Create a node type Supplier represented as factory, default swim-lane Source.
Create a node type Warehouse represented as warehouse.
Create a node type Manufacturing represented as gear, default swim-lane Make.
Create a node type Customer represented as person, default swim-lane Deliver.
```

END OF CONFIGURATION

**User:**
```
Create note categories: constraints, assumptions.

Add note "Each supplier has unique characteristics: lead time, reliability, MOQ, and payment terms" in category constraints.
Add note "Finished products have strict shelf life (expiry date) requirements that generate obsolescence costs if exceeded" in category constraints.
Add note "The raw materials warehouse and the finished goods warehouse have limited capacity expressed in pallet locations" in category constraints.
```

**User:**
```
Create raw materials "Fruit concentrate", "Additive".
Create packagings "Carton packs (Tetra Pak)", "Plastic bottles (PET)", "Outer cartons", "Pallets".

Create a supplier "Ingredients & Packaging Suppliers" with a flow to "Raw Materials Warehouse".
```

**User:**
```
Create a warehouse "Raw Materials Warehouse" in swim-lane Source.
Create a manufacturing site "Mixing Department (Blending)".
Create a manufacturing site "Packaging Lines (Filling)".
Create a warehouse "Finished Goods Warehouse" in swim-lane Deliver.

Create a flow from "Raw Materials Warehouse" to "Mixing Department (Blending)".
Create a flow from "Mixing Department (Blending)" to "Packaging Lines (Filling)".
Create a flow from "Packaging Lines (Filling)" to "Finished Goods Warehouse".
```

**User:**
```
Create finished goods "Orange Juice 1L", "Multifruit Juice 1L", "Single Serve Formats".

Create customers "Retail Channels (Supermarkets, Discounters, Gas Stations)".

Create a flow from "Finished Goods Warehouse" to "Retail Channels (Supermarkets, Discounters, Gas Stations)" with products "Orange Juice 1L", "Multifruit Juice 1L", "Single Serve Formats".
```