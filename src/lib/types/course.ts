// Course and Fee Structure related types

export interface Course {
	id: string;
	name: string;
	termsPerYear: number;
}

export interface FeeStructure {
	id: number;
	course: Course;
	year: number;
	term: number;
	amount: number;
	isActive: boolean;
}

// Search parameters for fee structure API
export interface FeeStructureSearchParams {
	year?: number;
	courseId?: string;
	term?: number;
}

// Grouped data for display
export interface CourseWithFees {
	course: Course;
	totalYearlyFee: number;
	termFees: FeeStructure[];
	averageTermFee: number;
}

export interface YearlyFeeData {
	year: number;
	courses: CourseWithFees[];
	totalCourses: number;
}