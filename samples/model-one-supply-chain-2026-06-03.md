# Model One Supply Chain — 2026-06-03

## Extraction notes

- +60 Days annotation on HUB — direction and scope unclear, kept as annotation.
- Cumulative Lead Time line spans the full diagram — individual segment lead times extracted where clearly attached to a flow, cumulative values ignored.
- DC nodes are 4 identical distribution centres — named DC1 to DC4 for disambiguation, actual names to be confirmed.
- 3rd Party Pack is a co-packer (external subcontractor), not a product node.

**Project specific instructions:**
```
The industry sector is food & beverage or consumer goods.
```

**User:**
```
Create swim-lanes Distribution, Manufacturing.
```

**User:**
```
Group lanes Distribution, Manufacturing from left to right.
```

**User:**
```
Create a product node type represented as a dark rectangle in dark green.
Create a node type DC represented as an oval in blue, default swim-lane Distribution.
Create a node type Warehouse represented as a dark rectangle in dark green, default swim-lane Manufacturing.
Create a node type Packaging represented as an oval in green, default swim-lane Manufacturing.
Create a node type Manufacturing represented as a dark rectangle in dark green, default swim-lane Manufacturing.
```

END OF CONFIGURATION

**User:**
```
Create product types: finished good, raw material.
```

**User:**
```
Create finished goods FG 1 and FG 2.
Create raw materials RM 1 and RM 2.
```

**User:**
```
Create DCs: DC1, DC2, DC3, DC4.
Create warehouse HUB in swim-lane Distribution.
```

**User:**
```
Create raw material nodes RM 1 and RM 2 in swim-lane Manufacturing.
Create manufacturing node MIX/BLEND.
Create a flow from RM 1 to MIX/BLEND, lead time 30 days.
Create a flow from RM 2 to MIX/BLEND, lead time 30 days.
```

**User:**
```
Create warehouse SA.
Create warehouse Packaging SA.
Create a flow from MIX/BLEND to SA.
Create a flow from MIX/BLEND to Packaging SA.
```

**User:**
```
Create packaging nodes Pack Line 1 and Pack Line 2.
Create a flow from SA to Pack Line 1, lead time 7 days.
Create a flow from SA to Pack Line 2, lead time 7 days.
Create a flow from Packaging SA to Pack Line 1.
Create a flow from Packaging SA to Pack Line 2.
```

**User:**
```
Create co-packer 3rd Party Pack.
Create a flow from Packaging SA to 3rd Party Pack, lead time 1 day.
Create a flow from 3rd Party Pack to HUB.
```

**User:**
```
Create product node FG 1 in swim-lane Manufacturing. Create a flow from Pack Line 1 to FG 1.
Create product node FG 2 in swim-lane Manufacturing. Create a flow from Pack Line 2 to FG 2.
Create a flow from FG 1 to HUB, lead time 2 days.
Create a flow from FG 2 to HUB, lead time 2 days.
```

**User:**
```
Create product node FG 1 in swim-lane Distribution. Create a flow from HUB to FG 1.
Create product node FG 2 in swim-lane Distribution. Create a flow from HUB to FG 2.
Create flows from HUB to DC1, DC2, DC3, DC4, lead time 2 to 5 days.
Create flows from FG 1 to DC1 and DC4.
Create flows from FG 2 to DC2.
```

**User:**
```
Add annotation "Cumulative Lead Time" to swim-lane Manufacturing.
Add annotation "+60 Days" to swim-lane Distribution.
Add annotation "Sales Order Horizon" — unidentified scope.
```

**User:**
```
Create note categories: assumptions, open questions.
```

**User:**
```
Add note "DC nodes named DC1–DC4 for disambiguation — actual names to be confirmed." in category assumptions.
Add note "+60 Days annotation on HUB — scope and meaning to be confirmed." in category open questions.
Add note "Sales Order Horizon annotation — exact scope unclear." in category open questions.
Add note "Some flow connections between FG product nodes and DCs may be incomplete — source diagram is dense." in category assumptions.
```
