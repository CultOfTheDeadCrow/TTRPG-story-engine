# Shadowrun Story Engine — Functional Spec

## Overview

A local, single-user GM tool for managing a Shadowrun tabletop RPG campaign. The tool maintains a persistent knowledge base of campaign entities (characters, locations, events) and supports two primary workflows:

1. **Story Generation** — the GM prompts Claude to generate a scene. Claude produces prose and proposes updates to the knowledge base based on the generated events.
2. **Session Protocol Import** — after a real play session, the GM pastes their session notes. Claude reads the notes against the current knowledge base and proposes updates to reflect what actually happened at the table.

In both workflows, proposed updates go through the same diff review step before being written to the database.

---

## Entity Management

The knowledge base consists of three entity types: **Characters**, **Locations**, and **Events**. All three share the same data model and UI patterns.

### Shared Fields

Every entity has the following fields:

- **Name** — free text, required
- **Status** — a type-specific enum (see below)
- **Tags** — a list of free-text labels (e.g. `["Aztechnology", "contact", "dangerous"]`)
- **Description** — a longer free-text field describing the entity in narrative terms
- **Notes** — a separate free-text field intended for GM-only information not part of the in-world description (e.g. secrets, future plot hooks, mechanical notes)
- **Change History** — a read-only, append-only log of all changes made to the entity via story updates (see below). Each entry contains a timestamp and a human-readable description of what changed and why.

### Status Values

Status is a per-type enum that allows at-a-glance assessment of entity state:

- **Characters**: `active`, `inactive`, `dead`, `unknown`
- **Locations**: `secure`, `hostile`, `neutral`, `unknown`
- **Events**: `ongoing`, `resolved`, `past`

### Entity Operations

The GM can perform the following operations on entities:

- **Create** a new entity of any type with default empty values
- **Edit** any field on an existing entity and save the changes
- **Delete** an entity (with confirmation prompt). Deletes the entity and all associated history entries.
- **View history** for any entity, showing all story-driven changes in reverse chronological order

### Entity List View

Each entity type has a list sidebar showing all entities of that type. Each list entry shows the entity name and a small colored status indicator. Clicking an entry opens the editor for that entity.

---

## Story Generator

The Story Generator is the primary workflow of the tool. The GM selects context, writes a prompt, receives a generated story scene, and optionally applies proposed changes to the knowledge base.

### Context Selection

Before generating, the GM selects which entities should be provided to Claude as context. This is done via a checklist of all existing entities, grouped by type. The GM can select individual entities or use a "select all" shortcut per type.

If no entities are selected, all entities in the knowledge base are used as context. If specific entities are selected, only those are passed.

The intent is to allow focus: for a scene involving only two specific characters in one location, the GM can limit context to those three entities and avoid noise.

### Prompt Input

A free-text input where the GM describes the scene or situation to be generated. There are no structural constraints on the prompt — it can be as brief as "Die Gruppe wird in einem Hinterhalt angegriffen" or as detailed as a full scenario brief. Both German and English are supported.

### Generation

On submission, the prompt and selected context are sent to Claude. Claude receives the full field data of all context entities (name, status, tags, description) and is instructed to produce a Shadowrun-appropriate scene in Shadowrun's established tone: noir, cyberpunk, urban fantasy, morally complex.

Claude returns two things:

1. **The generated story** — a prose narrative of the scene, written to be usable directly as GM narration or as a basis for further editing
2. **Proposed entity updates** — a list of specific, targeted changes to entity fields that are narratively justified by the events of the story (e.g. a character dies → `status: dead`; a location is destroyed → `status: hostile`, updated description)

### Diff Review

After generation, proposed updates are shown in a separate panel below the story output. Each proposed update shows:

- Which entity is affected (name and type)
- Which field is being changed
- The new value
- A brief reason explaining why this change is being proposed

Each proposed update has a checkbox. All updates are pre-checked by default. The GM can uncheck any updates they want to reject.

Once the GM is satisfied with the selection, they click **Apply**. Only the checked updates are written to the database. Each applied update also appends an entry to that entity's change history, including the timestamp, the field changed, the new value, and Claude's stated reason.

Applying updates also persists the story itself (prompt text, story output, and the IDs of context entities used) as a record in the database.

The Apply action is final and cannot be undone through the UI. The GM is expected to use entity editing directly if they want to revert a change.

### Story Archive

All previously generated stories are stored and browsable. Each story record shows the original prompt, the full story text, the timestamp, and which entities were used as context.

---

## Session Protocol Import

The Session Protocol Import is the retrospective counterpart to the Story Generator. Where the Story Generator produces content for future or hypothetical scenes, the Protocol Import processes what actually happened during a real session and synchronizes the knowledge base accordingly.

### Input

The GM pastes free-form session notes into a large text area. There are no formatting requirements. The input can be:

- Raw, unstructured notes taken during play ("Yoko hat den Wachmann ausgeschaltet. Gruppe hat das Labor gefunden, war leer. Fixer wurde angerufen, kein Signal.")
- A structured after-action write-up
- A transcript or edited summary of the session
- A mix of all of the above

Both German and English are accepted. The input does not need to reference entity names consistently or correctly — Claude is expected to resolve approximate references ("der Russe", "das Labor im Keller") against the knowledge base.

### Analysis

On submission, the full session notes are sent to Claude together with the complete current knowledge base (all entities, all fields). Claude is instructed to:

1. Identify every event in the notes that has a consequence for one or more known entities
2. For each such consequence, propose a specific, targeted update to the affected entity (field, new value, reason)
3. Additionally propose the creation of new entities if the notes introduce named characters, locations, or significant events not yet in the knowledge base

Claude is explicitly instructed not to infer or invent consequences that are not supported by the notes. If the notes are ambiguous, Claude should reflect that ambiguity in the proposed reason rather than pick an interpretation silently.

### New Entity Proposals

If Claude identifies references to entities not yet in the knowledge base (e.g. a new NPC is named for the first time, a new location is visited), it proposes the creation of that entity. New entity proposals appear in the same diff review panel as field updates, but are visually distinct — they show the full set of proposed initial values (name, type, status, description, tags) rather than a before/after for a single field.

The GM can accept or reject each new entity proposal individually, the same as any other proposed update.

### Diff Review

The result of protocol analysis goes through the same diff review flow as the Story Generator: a checklist of proposed changes, all pre-checked, with the ability to uncheck and reject individual items before applying.

Each proposed change shows:

- Which entity is affected (or that it is a new entity)
- Which field is being changed and to what value
- The specific passage or event from the session notes that justifies the change

The last point is important: Claude must ground every proposed change in a concrete excerpt or paraphrase from the GM's own notes, so the GM can verify the reasoning without re-reading the entire input.

### Apply

Accepted updates are applied to the database using the same mechanism as story-driven updates: field values are written and a history entry is appended to each affected entity, noting the timestamp and that the change originated from a session protocol import (as opposed to a story generation or a manual edit).

The session notes themselves are stored as a record in the database, linked to the timestamp of the import and the list of entity changes that were applied from them.

### Conflict Handling

It is possible that the session notes describe something that contradicts the current state of an entity in the knowledge base (e.g. the notes say a character was killed, but their status is still `active`). Claude should flag such contradictions explicitly in the proposed update rather than silently overwriting. The GM sees the current value, the proposed value, and a note that this update resolves a detected contradiction.

---

## Navigation & Layout

The UI is a two-panel layout:

- **Left sidebar**: navigation between the Story Generator, the Session Protocol Import, and the three entity type lists. Entity lists show all items with status indicators. A button at the bottom of each list creates a new entity of that type.
- **Main area**: either the Story Generator or the entity editor for the currently selected entity, depending on navigation state.

---

## Data Persistence

All data is stored locally in a SQLite database. Nothing is sent to any external service except the Claude API call during story generation (which sends entity data and the prompt). The database file is a single file on disk and can be backed up by copying it.

---

## Out of Scope (explicitly not in v1)

- **Relations between entities** — no explicit graph of which characters know each other, which characters are linked to which locations, etc. This can be expressed through tags and descriptions for now.
- **Multi-user / sync** — strictly single user, no collaboration features
- **Export** — no PDF export, no sharing format
- **Image support** — no portraits, maps, or other media attached to entities
- **Undo** — no undo for applied story updates
- **Campaign switching** — one campaign per installation, no multi-campaign management
