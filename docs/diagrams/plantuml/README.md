# Link Studio — PlantUML sources

Alternate diagrams of the implemented system, matching migrations001–007 and existing Mermaid documentation. All three render successfully with PlantUML1.2026.8 locally. Java/PlantUML tooling is kept in ignored tmp only; no application dependency changed.

| Diagram | Copyable source | Rendered preview |
|---|---|---|
| DFD Level0:9 processes,9 stores,53 named flows | [dfd-level-0.puml](dfd-level-0.puml) | [SVG](dfd-level-0.svg) |
| ER:9 tables,49 columns, actual FK cardinalities | [er.puml](er.puml) | [SVG](er.svg) |
| Modular monolith architecture | [architecture.puml](architecture.puml) | [SVG](architecture.svg) |

Copy one complete source, from @startuml through @enduml, into draw.io: Arrange > Insert > Advanced > PlantUML > Preview > Insert. Use three drawing pages named DFD Level0, ER Diagram and Architecture Diagram. The DFD uses labelled ellipses for numbered processes, rectangles for external entities and database symbols for logical data stores; it is a data-flow model, not UML use-case semantics or an execution flowchart. The full DFD is wide; use SVG zoom to read all flow labels.

The current draw.io implementation supports only part of PlantUML. Import inside draw.io was not exercised during this task. If a construct does not render there, render with full PlantUML and import the SVG instead (an image, not independently editable shapes). Verify cardinalities and labels after import and before sharing. Official guide: https://www.drawio.com/docs/manual/insert/insert_plantuml/

Schema contracts: links.owner_id is nullable with ON DELETE SET NULL; other actual FKs use CASCADE. Sessions have a logical user reference in sess.passport.user and no relational FK. Language/theme remain browser-only. PNG cache, CSV audit and Preview views are separate from click_events. DFD/ER describe repository source, not a new verification of production database state.
