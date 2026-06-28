# Proposal: Payload CMS Backend Architecture & Implementation
### Best Coast Tours

---

## Executive Summary

Best Coast Tours is seeking an experienced Payload CMS developer to review, refine, and expand the existing backend architecture to support the next version of the website.

The current Payload CMS implementation already contains a well-organized collection structure covering tours, cities, branches, pickup locations, pricing, and supporting content. The objective is not a full rebuild — it is to evolve the existing architecture into a scalable, relationship-driven content ecosystem that empowers non-technical users to manage and expand the platform without developer intervention.

This proposal outlines the scope, architecture recommendations, phased approach, and timeline for delivering a production-ready Payload CMS backend that supports the long-term vision of a Southern California tourism platform.

---

## Project Understanding

### Core Objectives
- Make the website **fully editable** through Payload CMS
- Payload becomes the **single source of truth** for all content
- Non-technical users can create pages, manage content, and control SEO
- Build a **structured content ecosystem** with strong internal relationships
- Support the frontend redesign currently in progress

### Confirmed Content Hierarchy
```
Master Funnel    (e.g., Los Angeles Tours)
      ↓
Sub-Funnel       (e.g., Los Angeles Tours from Orange County)
      ↓
City             (e.g., Anaheim)
      ↓
Tour             (e.g., Private Full-Day LA Tour from Anaheim)
```

### Key Clarifications from Joseph
- **Branches** are regional/operational support entities — not part of the primary navigation hierarchy
- **Funnels & Attractions** are expected to become dedicated collections, pending architectural recommendation
- The goal is a **connected tourism ecosystem**, not a collection of disconnected pages

---

## Current Architecture Assessment

### Existing Collections (Reviewed)

| Group | Collections |
|---|---|
| **Content** | Blogs, Landing Pages, Partners, FAQs, Testimonials & Reviews |
| **Location** | Territories, Branches, Cities, Stops, Pickup Locations |
| **Tours** | Tours, Tour Compare, Tour Types, Tour Categories, Pricing Templates |
| **Integration** | Providers |
| **Global** | Header, Footer, Homepage, About Us, Global Settings, SEO, Analytics |

### Assessment

| Area | Rating | Notes |
|---|---|---|
| Collection Organization | ✅ Strong | Well-separated domains |
| SEO Fields | ✅ Strong | Meta, OG, Canonical, NoIndex, Schema, JSON-LD |
| Content Separation | ✅ Good | Tours, Cities, Branches properly isolated |
| Funnel Architecture | ❌ Missing | No dedicated Funnel/Sub-Funnel model |
| Attractions | ❌ Missing | Only exists as text references in tours |
| Content Blocks | ❌ Missing | No reusable block system |
| Relationship Engine | ⚠️ Limited | Basic relationships exist, needs expansion |
| Internal Linking | ⚠️ Limited | No systematic approach |

### Conclusion
> The existing architecture provides a solid foundation. Approximately **70-80%** of the current structure can be retained or extended. The primary work involves adding new collections, expanding relationships, and implementing reusable content blocks.

---

## Scope of Work

### Phase 1 — Architecture Audit & Design (Week 1-2)

**Objective:** Deep-dive into the existing codebase, identify issues, and finalize the content architecture.

- Full source code review of all Payload collections and configurations
- Document existing schemas, relationships, and data flows
- Identify bugs, technical debt, and architectural issues
- Design the final content model and relationship graph
- Finalize collection schemas for new entities (Funnels, Attractions)
- Define reusable Content Blocks system
- Produce architecture documentation for team alignment

**Deliverables:**
- Architecture audit report
- Finalized content model diagram
- Collection schema specifications
- Bug/issue inventory

---

### Phase 2 — Core Collections & Relationships (Week 3-4)

**Objective:** Build new collections and expand existing ones to support the content hierarchy.

#### New Collections

**Funnels (Master & Sub)**
```
Funnel {
  title, slug, type (master | sub)
  parentFunnel → Funnel
  cities → City[]
  tours → Tour[]
  attractions → Attraction[]
  relatedBlogs → Blog[]
  contentBlocks → Block[]
  seo → SEO
}
```

**Attractions**
```
Attraction {
  title, slug, description
  images, location
  tours → Tour[]
  cities → City[]
  funnels → Funnel[]
  blogs → Blog[]
  contentBlocks → Block[]
  seo → SEO
}
```

#### Refactored Collections

**Cities** — Expand relationships:
- Add: `funnels[]`, `tours[]`, `attractions[]`, `relatedCities[]`, `contentBlocks[]`
- Modify: Branch from required → optional
- Add: FAQs, Hotels/Pickup info sections

**Tours** — Expand relationships:
- Add: `funnels[]`, `attractions[]`, `relatedTours[]`, `contentBlocks[]`
- Enhance: Itinerary content, pricing display, pickup information

**Branches** — Adjust role:
- Add: `funnels[]`, `relatedExperiences[]`
- Clarify as regional support entity

**Landing Pages** — Evaluate and migrate:
- Determine if existing Landing Pages should be migrated to Funnels
- Retain collection for non-funnel static pages if needed

---

### Phase 3 — Content Blocks, SEO & Related Content (Week 5-6)

**Objective:** Implement the reusable block system, SEO enhancements, and related content engine.

#### Reusable Content Blocks

Define Payload Blocks that editors can add, remove, and reorder:

| Block | Purpose |
|---|---|
| `HeroBlock` | Hero section with title, subtitle, background image, CTA |
| `RichContentBlock` | Flexible rich text content |
| `FAQBlock` | FAQ accordion with structured data support |
| `TourComparisonBlock` | Side-by-side tour comparison |
| `CitiesWeServeBlock` | Editable city list with descriptions, ordering, visibility |
| `FeaturedAttractionsBlock` | Attraction showcase with relationships |
| `RelatedToursBlock` | Related tours with manual/automatic selection |
| `RelatedBlogsBlock` | Related blog posts |
| `CTABlock` | Call-to-action sections |
| `GalleryBlock` | Image/video gallery |
| `TestimonialsBlock` | Customer testimonials |
| `ScheduleBlock` | Schedule & availability information |

#### Page Layout Management (Drag & Drop Ordering)

Every content page (Funnels, Cities, Tours, Attractions, Branches) will include a **layout builder** field powered by Payload Blocks. This gives editors full control over page structure directly from the Payload admin panel.

**Capabilities:**
- **Add blocks** — editors select from the available block library to add new sections
- **Remove blocks** — editors can remove any section from a page
- **Drag & drop reorder** — editors rearrange the display order of sections by dragging blocks up or down
- **Per-page customization** — each page can have a unique arrangement of blocks, independent of other pages of the same type

**How it works in Payload Admin:**
```
☰ Hero                    ↕ drag to reorder
☰ Tour Comparison         ↕ drag to reorder
☰ Cities We Serve         ↕ drag to reorder
☰ Featured Attractions    ↕ drag to reorder
☰ FAQ                     ↕ drag to reorder
☰ Related Blogs           ↕ drag to reorder
☰ CTA                     ↕ drag to reorder

[ + Add Block ]
```

**Example — City Page (Anaheim):**
```
1. Hero
2. Overview Content
3. Tour Comparison
4. Pickup Locations
5. Cities We Serve
6. FAQ
7. Related Blogs
```

Editor reorders to:
```
1. Hero
2. Tour Comparison
3. Overview Content
4. FAQ
5. Cities We Serve
6. Related Blogs
7. Pickup Locations
```

The frontend renders blocks in the exact order defined by the editor — no developer needed.

**Applied to all page types:**

| Page Type | Layout Builder |
|---|---|
| Master Funnel | ✅ Drag & drop block ordering |
| Sub-Funnel | ✅ Drag & drop block ordering |
| City | ✅ Drag & drop block ordering |
| Tour | ✅ Drag & drop block ordering |
| Attraction | ✅ Drag & drop block ordering |
| Branch | ✅ Drag & drop block ordering |

#### SEO Architecture

- Standardize SEO fields across all content types
- Meta Title, Meta Description, Canonical URL, NoIndex
- Custom H1 support
- FAQ structured data (JSON-LD) generation
- Dynamic sitemap generation support
- Breadcrumb data structure
- Schema markup fields (Organization, Tour, Place, FAQ)
- Internal linking opportunity fields

#### Related Content Engine

Unified relationship system across all collections:
- Related Tours
- Related Cities
- Related Funnels
- Related Attractions
- Related Blogs
- Related Locations

Each relationship supports:
- Manual selection (editorial control)
- Display ordering
- Visibility toggles
- Context-specific descriptions

---

### Phase 4 — Bug Fixes, Testing & Handoff (Week 7)

**Objective:** Fix identified bugs, test the complete system, and prepare documentation.

- Fix bugs identified during Phase 1 audit
- Resolve technical debt issues
- End-to-end testing of all collections and relationships
- Admin UI/UX verification for non-technical users
- API response testing for frontend integration
- Payload Admin access control review
- Final documentation and handoff

**Deliverables:**
- Bug fix log
- Test results
- API documentation for frontend developer
- Admin user guide
- Content model reference

---

## Proposed Content Architecture

### Relationship Graph
```
                    ┌──────────────┐
                    │   Branches   │
                    │  (Regional)  │
                    └──────┬───────┘
                           │ optional
┌──────────┐       ┌──────┴───────┐       ┌──────────────┐
│  Blogs   │◄──────│    Cities    │──────►│  Attractions  │
└──────────┘       └──────┬───────┘       └──────┬────────┘
     ▲                    │                      │
     │              ┌─────┴──────┐               │
     │              │   Tours    │◄──────────────┘
     │              └─────┬──────┘
     │                    │
     │             ┌──────┴───────┐
     └─────────────│   Funnels   │
                   │ master/sub  │
                   └─────────────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
          Cities[]    Tours[]   Attractions[]
```

### Supporting Collections
```
Tours ──► Stops, Pickup Locations, Pricing Templates
Tours ──► Tour Types, Tour Categories
Cities ──► Pickup Locations, Hotels
All   ──► FAQs, Content Blocks, SEO
```

---

## Timeline

| Week | Phase | Focus |
|---|---|---|
| **Week 1** | Phase 1 | Source code review, bug inventory, schema documentation |
| **Week 2** | Phase 1 | Architecture design, content model finalization |
| **Week 3** | Phase 2 | Funnels collection, Attractions collection |
| **Week 4** | Phase 2 | Refactor Cities, Tours, Branches, Landing Pages |
| **Week 5** | Phase 3 | Content Blocks system, Page Layout Management (drag & drop ordering) |
| **Week 6** | Phase 3 | Related Content Engine, SEO architecture, internal linking, sitemap |
| **Week 7** | Phase 4 | Bug fixes, testing, documentation, handoff |

**Total estimated timeline: 6-7 weeks**

---

## Deliverables

| # | Deliverable | Phase |
|---|---|---|
| 1 | Architecture audit report | Phase 1 |
| 2 | Content model documentation | Phase 1 |
| 3 | Funnels collection (master/sub) | Phase 2 |
| 4 | Attractions collection | Phase 2 |
| 5 | Expanded Cities collection | Phase 2 |
| 6 | Expanded Tours collection | Phase 2 |
| 7 | Reusable Content Blocks system | Phase 3 |
| 8 | Page Layout Management (drag & drop block ordering for all page types) | Phase 3 |
| 9 | Related Content Engine | Phase 3 |
| 10 | SEO architecture enhancements | Phase 3 |
| 11 | Bug fixes from audit | Phase 4 |
| 12 | API documentation for frontend | Phase 4 |
| 13 | Admin user guide | Phase 4 |

---

## Assumptions & Exclusions

### Assumptions
- Access to the current Payload CMS source code and admin panel will be provided
- The frontend redesign is handled separately by the Next.js developer
- Collaboration with the frontend developer for API contract alignment is included
- Existing content and data will be preserved during refactoring
- The project uses Payload CMS 2.x or 3.x (to be confirmed)

### Exclusions
- Frontend development (Next.js pages, components, rendering)
- Visual design or UI/UX design
- Content creation or content migration/entry
- Customer portals, vendor portals, CRM, or operational tools
- Hosting, deployment, or DevOps configuration
- Multi-language / internationalization support (unless requested)

---

## Why This Approach

This proposal prioritizes **evolution over revolution**:

- **70-80% of existing collections are retained** — minimizing disruption and preserving existing content
- **New collections are additive** — Funnels and Attractions extend the ecosystem without breaking current functionality
- **Content Blocks provide flexibility** — editors can customize pages without developer involvement
- **The relationship engine scales** — as new content types are added (Hotels, Wineries, Restaurants), they plug into the same relationship pattern
- **SEO is built into every entity** — supporting the long-term goal of topical authority across Southern California tourism

---

> **Next Steps:**
> Upon approval, I will request access to the Payload CMS source code and admin panel to begin Phase 1.
