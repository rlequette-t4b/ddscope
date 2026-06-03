# Niedercorn Supply Chain — 2026-06-03

## Extraction notes

- Two nodes named "Semi-FG" identified in the source — likely distinct warehouses with different roles, actual names to be confirmed with the client.
- No lead times found in the source.
- No products explicitly identified — flows carry unspecified materials.
- Flow directions in the central area of the diagram are dense and may be incomplete.

**Project specific instructions:**
```
The industry sector is chemicals or plastics/composites.
```

**User:**
```
Create swim-lanes Customer, Niedercorn, Supplier.
```

**User:**
```
Group lanes Customer, Niedercorn, Supplier from left to right.
```

**User:**
```
Create a node type Warehouse represented as a building icon 🏭 in blue, default swim-lane Niedercorn.
Create a node type Customer represented as a person icon 👤, default swim-lane Customer.
Create a node type Supplier represented as a factory icon 🏗️, default swim-lane Supplier.
```

END OF CONFIGURATION

**User:**
```
Create customers Internal and External.
```

**User:**
```
Create suppliers External and Internal in swim-lane Supplier.
```

**User:**
```
Create warehouses Raw Mat, Resin, Colours, Packaging and others.
Create a flow from External supplier to Raw Mat.
Create a flow from External supplier to Resin.
Create a flow from External supplier to Colours.
Create a flow from External supplier to Packaging and others.
Create a flow from Internal supplier to Packaging and others.
```

**User:**
```
Create warehouse Semi-FG (right).
Create flows from Raw Mat, Resin, Colours, and Packaging and others to Semi-FG (right).
```

**User:**
```
Create warehouse FG - Manuf.
Create a flow from Semi-FG (right) to FG - Manuf.
Create a flow from FG - Manuf to Internal customer.
```

**User:**
```
Create warehouse Semi-FG (left).
Create a flow from Semi-FG (right) to Semi-FG (left).
```

**User:**
```
Create warehouse FG - ATO.
Create flows from FG - Manuf and Semi-FG (left) to FG - ATO.
Create a flow from FG - ATO to External customer.
```

**User:**
```
Create warehouse FG - Interco.
Create a flow from FG - Manuf to FG - Interco.
```

**User:**
```
Create note categories: assumptions, open questions.
```

**User:**
```
Add note "Two Semi-FG warehouses identified — named Semi-FG (right) and Semi-FG (left) for disambiguation, actual names to be confirmed." in category assumptions.
Add note "No lead times identified in the source." in category assumptions.
Add note "No products explicitly identified — flows carry unspecified materials." in category open questions.
```
