# Bericap France Supply Chain — Usine France, Bâtiment D — 2026-06-03

## Extraction notes

- No lead times found in the source — the VSM explicitly states: "Le délai vient surtout du stock et de l'instabilité prod, pas de la transformation — durées à quantifier."
- Bâtiment A (inline production, no semi-finished goods) is explicitly out of scope for this VSM.
- Information flows (blue layer: customer orders, purchase orders, push orders) are represented in the source but are out of scope per the guide. Captured as notes.
- Stock nodes are represented as inventory triangles (▽) in the source. Treated as stock nodes with type Inventory.
- Push flow arrows (hatched arrows) between process nodes indicate a push logic, not a distinct flow type — captured as notes on flows.
- Friction points ① through ⑤ are annotations on the map, elaborated in friction cards below the SVG. Both captured.
- The timeline bar at the bottom of the SVG distinguishes "stock" segments and "transfo." segments but provides no numeric values — captured as annotation.
- "Vittel ~100%" and "Longvic >85%" refer to warehouse saturation at named sites — captured as notes on the Magasin + expédition node.
- Customers Coca and Danone are named examples, not an exhaustive list — captured as note.
- Suppliers Total and Ineos are named; Total is flagged as stopping supply end of September — captured as note.

---

**Project specific instructions:**
```
The industry sector is plastics manufacturing / industrial packaging (bottle caps and closures).

This VSM represents the current state of Bericap France's production flow, scoped to Bâtiment D (decoupled, semi-finished goods flow). It was produced after a scoping day (cadrage J1) on 3 June 2026, as part of a DDMRP project led by b2wise. Bâtiment A (inline production, no semi-finished goods) follows a separate flow and is not modelled here.

The flow is entirely push-driven: SAP ECC + Excel macros generate work orders post by post with no reliable forecast. Five friction points were validated on the Gemba. The priority pilot is Bâtiment D: establish true decoupling points on semi-finished goods, switch to pull flow, and stabilise the MPS.
```

---

**User:**
```
Create swim-lanes Information, Flux physique.
```

**User:**
```
Group lanes Information, Flux physique from left to right.
```

**User:**
```
Create a product type finished good.
Create a product type semi-finished good.
Create a product type raw material.

Create a node type Supplier represented as 🏭 in gray, default swim-lane Information.
Create a node type Customer represented as 🏭 in gray, default swim-lane Information.
Create a node type Planning represented as a rectangle in blue, default swim-lane Information.
Create a node type Production process represented as a rectangle in teal, default swim-lane Flux physique.
Create a node type Inventory represented as ▽ in amber, default swim-lane Flux physique.
```

---

END OF CONFIGURATION

---

**User:**
```
Create a supplier named "Fournisseurs (Total · Ineos)".
Create a customer named "Clients (Coca · Danone)".
```

**User:**
```
Create a planning node named "Pilotage / planification" with notes "SAP ECC + Excel (macros). PIC/PDP manuels. Planning = ordonnancement.".
```

**User:**
```
Create an inventory node named "Silos MP" with notes "Raw material silos. Capacity is a constraint.".
Create a flow from "Fournisseurs (Total · Ineos)" to "Silos MP" with notes "Delivery by tanker. Push flow.".
```

**User:**
```
Create a production process node named "Injection (presses)" with notes "~40 presses. Mould setup 5–6 h. Planned OEE ≠ actual OEE. Maintenance backlog.".
Create a flow from "Silos MP" to "Injection (presses)" with notes "Push flow.".
```

**User:**
```
Create an inventory node named "Stock semi-fini (WIP)" with notes "Semi-finished goods. Cube racking + pallet racking.".
Create a flow from "Injection (presses)" to "Stock semi-fini (WIP)" with notes "Push flow.".
```

**User:**
```
Create a production process node named "Assemblage / déco" with notes "Assembly, decoration, laser. ~20 assembly operators. Specialist decorators. 72 h migration agent. Skill dependency.".
Create a flow from "Stock semi-fini (WIP)" to "Assemblage / déco" with notes "Push flow.".
```

**User:**
```
Create an inventory node named "Stock PF" with notes "Finished goods stock. Overflow reported.".
Create a flow from "Assemblage / déco" to "Stock PF" with notes "Push flow.".
```

**User:**
```
Create a production process node named "Magasin + expédition" with notes "Automated cube warehouse. AGVs. IDEO system. Output rate 6–7 pallets/h (bottleneck). Vittel ~100% full. Longvic >85% full.".
Create a flow from "Stock PF" to "Magasin + expédition" with notes "Push flow.".
Create a flow from "Magasin + expédition" to "Clients (Coca · Danone)" with notes "Delivery to customers.".
```

**User:**
```
Add annotation "① Pilotage manuel sans prévision — PIC/PDP Excel, pas de 12 mois glissants ni d'alerte volume. Ordo à 12 sem face à un client ±30 % j/j. Levier : APS + prévision, découplage planning/ordo, lissage automatisé." to swim-lane Information.
Add annotation "② Appro matières sous contingentement + perte de savoir — Total stoppe fin sept., fournisseurs rationnent, ruptures silos inexpliquées, resp. achats part dans 18 mois. Levier : besoins matière dérivés du S&OP, buffers appro DDMRP, savoir outillé." to swim-lane Flux physique.
Add annotation "③ Flux poussé sur une production instable — TRS planifié faux, backlog maintenance, Powerade mal maîtrisé (Express permanent) → non-service, rebuts, OTIF < 80 %. Levier : priorisation visuelle rouge/jaune/vert, TRS réel en planif." to swim-lane Flux physique.
Add annotation "④ Semi-fini opportuniste + goulot de sortie cube — WIP créé sans seuil de découplage, sortie cube limitée à 6–7 pal/h, facteur limitant pour alimenter le laser. Levier : vrais points de découplage dimensionnés + buffers semi-fini pilotés." to swim-lane Flux physique.
Add annotation "⑤ Stock 9 M€ saturé & peu efficace — Ruptures + surstocks simultanés, place incertaine pour les nouveaux produits, objectifs sur le CA pas la marge. Levier : buffers dynamiques, marge contributive, objectifs collectifs." to swim-lane Flux physique.
Add annotation "Timeline (bottom bar): delay comes primarily from inventory and production instability, not from transformation steps — durations to be quantified.".
```

**User:**
```
Create note categories: assumptions, open questions, out of scope.

Add note "The VSM covers Bâtiment D only (decoupled, semi-finished goods flow). Bâtiment A (inline production, no semi-finished goods) follows a separate flow and is not modelled." in category out of scope.
Add note "Information flows captured in the source (customer orders and volatile forecasts → planning, purchase orders → suppliers, push work orders → each process step) are out of scope per the extraction guide." in category out of scope.
Add note "Lead times for all flows are not quantified in the source. The VSM explicitly states they remain to be measured." in category open questions.
Add note "Actual OTIF, real cycle times, and overflow cost remain to be measured before building a quantified future-state VSM." in category open questions.
Add note "Total (supplier) is stopping deliveries end of September. Supply rationing and unexplained silo shortages are active risks." in category assumptions.
Add note "The purchasing manager is leaving in 18 months — institutional knowledge risk flagged." in category assumptions.
Add note "Customers Coca and Danone are named as examples of volatile customers (±30% day-to-day). The customer list may not be exhaustive." in category assumptions.
Add note "The entire flow is push-driven: SAP ECC + Excel macros generate work orders post by post. No reliable forecast exists at time of scoping." in category assumptions.
Add note "Priority pilot recommended: Bâtiment D — establish true decoupling points on semi-finished goods, switch to pull flow, stabilise MPS. Expected benefit: time recovered from firefighting mode before targeting working capital and group-level capacity." in category assumptions.
```
