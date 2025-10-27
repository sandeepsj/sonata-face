import type { LayoutLoad } from './$types';

// Just pass the admission number from params to the layout component
// The actual API call will happen client-side where we have access to JWT token
export const load: LayoutLoad = async ({ params }) => {
	return {
		admissionNo: params.id
	};
};