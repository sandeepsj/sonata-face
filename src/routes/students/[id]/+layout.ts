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
		
		// If it's already a SvelteKit error, re-throw it
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		
		// Otherwise, throw a 500 error
		throw error(500, 'Failed to load student data');
	}
};