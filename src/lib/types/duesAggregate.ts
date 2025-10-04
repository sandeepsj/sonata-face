// Dues Aggregate Types

export interface DuesAggregateFilters {
	statuses?: string;
	year?: number;
	termNumber?: number;
	course?: string;
}

export interface DuesAggregateResponse {
	count: number;
	totalDue: number;
	filters?: DuesAggregateFilters;
}

export interface CourseAggregate {
	course: string;
	count: number;
	totalDue: number;
}

export interface YearAggregate {
	year: number;
	count: number;
	totalDue: number;
}

export interface TermAggregate {
	year: number;
	termNumber: number;
	count: number;
	totalDue: number;
}

export type AggregateGroupBy = 'course' | 'year' | 'term';

export interface DuesFilterParams {
	statuses?: string;
	year?: number;
	termNumber?: number;
	course?: string;
}
