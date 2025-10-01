<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Progress Tracker

- [x] Verify that the copilot-instructions.md file in the .github directory is created.
- [x] Clarify Project Requirements
- [x] Scaffold the Project
- [x] Customize the Project
- [x] Install Required Extensions
- [x] Compile the Project
- [x] Create and Run Task
- [x] Launch the Project
- [x] Students Page with Paginated API Integration
- [x] Theme Management with localStorage
- [x] Refactored Architecture (Services, Types, Stores)
- [ ] Ensure Documentation is Complete

## Project Details
**Project Name:** Revathi Arts and Music School Management Portal
**Framework:** SvelteKit with TypeScript
**UI Library:** DaisyUI + Tailwind CSS
**Architecture:** Layered service-oriented architecture
**Features:** 
- Sticky navigation toolbar with school name, theme toggle, and profile button
- Student management dashboard with paginated API
- Course scheduling interface (planned)
- Reporting dashboard with statistics (planned)

## Current Status
✅ **Foundation Complete:** SvelteKit + TypeScript + DaisyUI + theme persistence
✅ **Navigation:** Sticky navbar with theme switcher and profile dropdown
✅ **Students Page:** Paginated table with search, filtering, and CRUD operations
✅ **Architecture:** Refactored to layered service pattern

## Architecture Patterns & Guidelines

### 🏗️ **Layered Architecture**
Follow this structure for all new features:

### ⚠️ **CRITICAL: Data Passing from Layout to Pages**
**ALWAYS use SvelteKit's `load` function to pass data from layouts to pages - NOT slot props or context API**

This was a major issue that took significant debugging time. The solution pattern:

#### ✅ **Correct Approach - Use Load Functions:**
```typescript
// +layout.ts
import { error } from '@sveltejs/kit';
import { StudentService } from '$lib';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ params }) => {
  const studentId = params.id;
  
  if (!studentId) {
    throw error(400, 'Student ID is required');
  }

  try {
    const student = await StudentService.getStudent(Number(studentId));
    
    if (!student) {
      throw error(404, 'Student not found');
    }

    return {
      student
    };
  } catch (err) {
    console.error('Error loading student:', err);
    throw error(500, 'Failed to load student data');
  }
};

// +layout.svelte
<script lang="ts">
  import type { LayoutData } from './$types';
  
  export let data: LayoutData;
  $: student = data.student;
</script>

<div>
  <!-- Layout content -->
  <slot {student} />
</div>

// +page.svelte
<script lang="ts">
  import type { Student } from '$lib';
  
  export let student: Student; // Received from layout slot
</script>
```

#### ❌ **Avoid These Approaches:**
- Using `onMount()` + slot props (causes timing issues)
- Context API for layout-to-page data passing
- Client-side data fetching in layouts for SSR data

#### 🎯 **Why Load Functions Work Better:**
- **Server-Side Rendering**: Data fetched on server, faster initial loads
- **Automatic Error Handling**: Built-in error pages and boundaries  
- **TypeScript Support**: Generated types for layout data
- **Reactive Updates**: Automatic re-running when params change
- **No Timing Issues**: Data guaranteed available when components render
- **Standard Pattern**: Follows SvelteKit conventions

```
src/lib/
├── types/           # TypeScript interfaces and types
│   ├── student.ts   # Entity-specific types
│   ├── course.ts    # (future)
│   └── common.ts    # Shared types
├── api/             # API service layer
│   ├── config.ts    # API configuration and utilities
│   ├── studentService.ts  # Entity-specific services
│   └── courseService.ts   # (future)
├── stores/          # Svelte stores for state management
│   ├── studentStore.ts
│   └── themeStore.ts
└── index.ts         # Centralized exports
```

### 📝 **Type Definitions**
- Create entity-specific type files in `src/lib/types/`
- Use Spring Boot `Page<T>` response pattern for paginated APIs
- Include search parameter interfaces
- Example structure:
```typescript
export interface EntityName {
  id?: number;
  // ... entity fields
  [key: string]: any; // Allow additional fields
}

export interface EntitySearchParams {
  page?: number;
  size?: number;
  search?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export type EntityPageResponse = PageResponse<EntityName>;
```

### 🔌 **API Service Layer**
- Create service classes in `src/lib/api/`
- Use the common `apiRequest` utility from `config.ts`
- Include standard CRUD operations: `get`, `getAll`, `create`, `update`, `delete`
- Handle both paginated and array responses
- Example pattern:
```typescript
export class EntityService {
  static async getEntities(params: EntitySearchParams = {}): Promise<EntityPageResponse> {
    // Implementation with apiRequest
  }
  
  static async getEntity(id: number): Promise<Entity> {
    // Single entity fetch
  }
  
  // ... other CRUD operations
}
```

### 🗃️ **Store Pattern (Optional)**
- Create Svelte stores for complex state management
- Include loading, error, and pagination state
- Provide action methods for common operations
- Example pattern:
```typescript
function createEntityStore() {
  const { subscribe, set, update } = writable<EntityStoreState>(initialState);
  
  return {
    subscribe,
    async fetchEntities(page, size, search) { /* */ },
    async searchEntities(query) { /* */ },
    reset() { /* */ },
  };
}
```

### 📄 **Page Component Structure**
For new entity pages, follow this pattern:

1. **Import from `$lib`:** Import types and services from centralized exports
2. **Simple State:** Use reactive variables or store subscription
3. **Service Integration:** Use service classes instead of direct fetch calls
4. **Consistent UI:** Use DaisyUI components and established patterns
5. **Error Handling:** Include loading, error, and empty states

### 🎨 **UI/UX Patterns**
- **Navigation:** Update `+layout.svelte` navigation links for new pages
- **Tables:** Use DaisyUI `table table-zebra` with pagination controls
- **Cards:** Use `card bg-base-100 shadow-xl` for content sections
- **Forms:** Use DaisyUI form controls with validation
- **States:** Include loading spinners, error alerts, and empty states
- **Actions:** Use consistent button styling and icons from Lucide Svelte

### 🔧 **Development Guidelines**
- **API URLs:** Configure in `API_CONFIG.ENDPOINTS`
- **Error Handling:** Use `ApiError` class for consistent error reporting
- **Pagination:** Default page size in `API_CONFIG.DEFAULT_PAGE_SIZE`
- **Theme Support:** All components should work with theme switching
- **TypeScript:** Strict typing for all props, functions, and API responses
- **Responsive:** Mobile-first design with DaisyUI responsive classes

### 📁 **File Naming Conventions**
- Types: `entityName.ts` (camelCase)
- Services: `entityNameService.ts` (camelCase + Service suffix)
- Stores: `entityNameStore.ts` (camelCase + Store suffix)
- Pages: `+page.svelte` in route folders
- Components: `ComponentName.svelte` (PascalCase)

### 🧪 **Future Considerations**
- Component testing setup
- API response caching
- Offline support
- Form validation library
- Date/time utilities
- Export functionality

### 📚 **Lessons Learned**
- **Data Flow Issue**: Spent significant time debugging undefined props in page components when using slot props from layouts. **Solution: Always use SvelteKit load functions for layout-to-page data passing.**
- **Slot Props Limitation**: Direct slot prop passing from layouts to pages has timing issues in SvelteKit's routing system
- **Load Function Benefits**: Provides SSR support, automatic error handling, TypeScript integration, and eliminates timing issues

## Next Steps
- Create courses management page following the same patterns
- Add student detail/edit forms
- Implement reporting dashboard
- Add authentication and authorization