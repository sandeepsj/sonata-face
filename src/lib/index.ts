// place files you want to import through the `$lib` alias in this folder.

// Export types
export type { Student, StudentPageResponse, StudentSearchParams, StudentAdvancedSearchParams, PageResponse } from './types/student.js';
export type { Course, FeeStructure, CourseWithFees, FeeStructureSearchParams } from './types/course.js';

// Export API services
export { StudentService } from './api/studentService.js';
export { CourseService } from './api/courseService.js';
export { FeeStructureService } from './api/feeStructureService.js';
export { API_CONFIG, ApiError } from './api/config.js';

// Export stores
export { studentStore } from './stores/studentStore.js';
export { currentStudentStore } from './stores/currentStudentStore.js';
