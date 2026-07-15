# The Fresh Connection Supply Chain — Scénario Standard — 2026-07-15

## Extraction notes

- Les délais de livraison (*lead times*), capacités exactes et tailles de lots ne sont pas spécifiés de manière chiffrée dans la description et dépendent de la configuration de la session de jeu.
- Le rôle de chaque VP est mentionné dans la description générale mais n'est pas modélisé sous forme de flux physique direct.

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

Add note "Chaque fournisseur a ses propres caractéristiques : délai d'obtention, fiabilité, MOQ et conditions de paiement" in category constraints.
Add note "Les produits finis ont des exigences de durée de conservation (DLC/DLUO) strictes générant des coûts d'obsolescence en cas de dépassement" in category constraints.
Add note "L'entrepôt de matières premières et l'entrepôt de produits finis disposent d'une capacité limitée exprimée en emplacements palettes" in category constraints.
```

**User:**
```
Create raw materials "Concentré de fruits", "Additif".
Create packagings "Briques en carton (Tetra Pak)", "Bouteilles en plastique (PET)", "Cartons de regroupement", "Palettes".

Create a supplier "Fournisseurs Ingrédients & Emballages" with a flow to "Entrepôt Matières Premières".
```

**User:**
```
Create a warehouse "Entrepôt Matières Premières" in swim-lane Source.
Create a manufacturing site "Atelier de Mélange (Blending)".
Create a manufacturing site "Lignes de Conditionnement (Remplissage)".
Create a warehouse "Entrepôt Produits Finis" in swim-lane Deliver.

Create a flow from "Entrepôt Matières Premières" to "Atelier de Mélange (Blending)".
Create a flow from "Atelier de Mélange (Blending)" to "Lignes de Conditionnement (Remplissage)".
Create a flow from "Lignes de Conditionnement (Remplissage)" to "Entrepôt Produits Finis".
```

**User:**
```
Create finished goods "Jus d'orange 1L", "Jus multifruits 1L", "Formats individuels".

Create customers "Chaînes de grande distribution (Supermarchés, Discounters, Stations-services)".

Create a flow from "Entrepôt Produits Finis" to "Chaînes de grande distribution (Supermarchés, Discounters, Stations-services)" with products "Jus d'orange 1L", "Jus multifruits 1L", "Formats individuels".
```