// place files you want to import through the `$lib` alias in this folder.

// Export types
export type { Student, StudentPageResponse, StudentSearchParams, StudentAdvancedSearchParams, PageResponse } from './types/student.js';
export type { Course, FeeStructure, CourseWithFees, FeeStructureSearchParams } from './types/course.js';
export type { StudentSession, CreateStudentSessionRequest, StudentSessionSearchParams, StudentSessionWithStatus } from './types/studentSession.js';
export type { FeeDuesTrackerDTO, DuesStatusType, PaymentTypeType, PaymentCreateRequest, PaymentDiscount, FeeDuesResponse, FeeDuesPageState } from './types/feeDues.js';
export { DuesStatus, PaymentType, calculateNetAmount, calculateTotalDiscount, validateDiscounts } from './types/feeDues.js';
export type { Payment, PaymentStudent, PaymentFeeStructure, PaymentHistoryResponse } from './types/payment.js';
export type { PaymentDiscount as PaymentDiscountDetail, PaymentTypeType as ApiPaymentType } from './types/payment.js';
export { PaymentTypeEnum, calculateAmountCleared, formatPaymentType } from './types/payment.js';
export type { DuesAggregateFilters, DuesAggregateResponse, CourseAggregate, YearAggregate, TermAggregate, AggregateGroupBy, DuesFilterParams } from './types/duesAggregate.js';
export type { SignupRequest, LoginRequest, AuthResponse, User, AuthState } from './types/auth.js';

// Export API services
export { StudentService } from './api/studentService.js';
export { CourseService } from './api/courseService.js';
export { FeeStructureService } from './api/feeStructureService.js';
export { StudentSessionService } from './api/studentSessionService.js';
export { FeeDuesService } from './api/feeDuesService.js';
export { PaymentService } from './api/paymentService.js';
export { DuesAggregateService } from './api/duesAggregateService.js';
export { AuthService } from './api/authService.js';
export { API_CONFIG, ApiError, setAuthFunctions } from './api/config.js';

// Export stores
export { studentStore } from './stores/studentStore.js';
export { currentStudentStore } from './stores/currentStudentStore.js';
export { feeStructureStore } from './stores/feeStructureStore.js';
export { authStore } from './stores/authStore.js';
export type { CurrentStudentState } from './stores/currentStudentStore.js';
export type { FeeStructureStoreState, FeeStructureCache } from './stores/feeStructureStore.js';
