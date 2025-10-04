<script lang="ts">
	import { Users, BookOpen, BarChart3, Calendar, TrendingUp } from 'lucide-svelte';
</script>

<div class="container mx-auto p-6">
	<!-- Welcome Hero -->
	<div class="hero bg-base-100 rounded-lg shadow-xl mb-8">
		<div class="hero-content text-center">
			<div class="max-w-md">
				<h1 class="text-5xl font-bold">Welcome to the Portal</h1>
				<p class="py-6 text-lg">
					Manage students, courses, and everything related to your arts and music school with ease.
				</p>
				<button class="btn btn-primary">Get Started</button>
			</div>
		</div>
	</div>

	<!-- Quick Stats with DaisyUI -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
		<div class="stats shadow">
			<div class="stat">
				<div class="stat-figure text-primary">
					<Users class="w-8 h-8" />
				</div>
				<div class="stat-title">Total Students</div>
				<div class="stat-value text-primary">156</div>
				<div class="stat-desc">↗︎ 12% increase</div>
			</div>
		</div>

		<div class="stats shadow">
			<div class="stat">
				<div class="stat-figure text-secondary">
					<BookOpen class="w-8 h-8" />
				</div>
				<div class="stat-title">Active Courses</div>
				<div class="stat-value text-secondary">24</div>
				<div class="stat-desc">↗︎ 2 new this week</div>
			</div>
		</div>

		<div class="stats shadow">
			<div class="stat">
				<div class="stat-figure text-accent">
					<Users class="w-8 h-8" />
				</div>
				<div class="stat-title">Instructors</div>
				<div class="stat-value text-accent">12</div>
				<div class="stat-desc">All active</div>
			</div>
		</div>

		<div class="stats shadow">
			<div class="stat">
				<div class="stat-figure text-success">
					<TrendingUp class="w-8 h-8" />
				</div>
				<div class="stat-title">Completion Rate</div>
				<div class="stat-value text-success">89%</div>
				<div class="stat-desc">↗︎ 5% from last term</div>
			</div>
		</div>
	</div>

	<!-- Dashboard Cards with DaisyUI -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
		<!-- Students Card -->
		<div class="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300">
			<div class="card-body">
				<div class="flex items-center space-x-4">
					<div class="avatar placeholder">
						<div class="bg-primary text-primary-content rounded-full w-12">
							<Users class="w-6 h-6" />
						</div>
					</div>
					<div>
						<h2 class="card-title">Students</h2>
						<p class="text-base-content/70">Manage student information and enrollment</p>
					</div>
				</div>
				<div class="card-actions justify-end mt-4">
					<button class="btn btn-primary">View Students</button>
				</div>
			</div>
		</div>

		<!-- Courses Card -->
		<div class="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300">
			<div class="card-body">
				<div class="flex items-center space-x-4">
					<div class="avatar placeholder">
						<div class="bg-secondary text-secondary-content rounded-full w-12">
							<BookOpen class="w-6 h-6" />
						</div>
					</div>
					<div>
						<h2 class="card-title">Courses</h2>
						<p class="text-base-content/70">Organize and schedule courses and lessons</p>
					</div>
				</div>
				<div class="card-actions justify-end mt-4">
					<button class="btn btn-secondary">View Courses</button>
				</div>
			</div>
		</div>

		<!-- Reports Card -->
		<div class="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300">
			<div class="card-body">
				<div class="flex items-center space-x-4">
					<div class="avatar placeholder">
						<div class="bg-accent text-accent-content rounded-full w-12">
							<BarChart3 class="w-6 h-6" />
						</div>
					</div>
					<div>
						<h2 class="card-title">Reports</h2>
						<p class="text-base-content/70">Track progress and generate reports</p>
					</div>
				</div>
				<div class="card-actions justify-end mt-4">
					<button class="btn btn-accent">View Reports</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Recent Activity -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<!-- Recent Enrollments -->
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<h2 class="card-title">
					<Calendar class="w-5 h-5" />
					Recent Enrollments
				</h2>
				<div class="overflow-x-auto">
					<table class="table table-zebra">
						<thead>
							<tr>
								<th>Student</th>
								<th>Course</th>
								<th>Date</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td>Ananya Sharma</td>
								<td>Classical Piano</td>
								<td>Today</td>
							</tr>
							<tr>
								<td>Rahul Patel</td>
								<td>Guitar Basics</td>
								<td>Yesterday</td>
							</tr>
							<tr>
								<td>Priya Singh</td>
								<td>Vocal Training</td>
								<td>2 days ago</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</div>

		<!-- Upcoming Classes -->
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<h2 class="card-title">
					<Calendar class="w-5 h-5" />
					Upcoming Classes
				</h2>
				<div class="space-y-3">
					<div class="alert alert-info">
						<div>
							<h3 class="font-bold">Classical Piano - Advanced</h3>
							<div class="text-xs">Today at 4:00 PM with Ms. Lakshmi</div>
						</div>
					</div>
					<div class="alert alert-warning">
						<div>
							<h3 class="font-bold">Guitar Ensemble</h3>
							<div class="text-xs">Tomorrow at 2:00 PM with Mr. Ravi</div>
						</div>
					</div>
					<div class="alert alert-success">
						<div>
							<h3 class="font-bold">Vocal Workshop</h3>
							<div class="text-xs">Friday at 10:00 AM with Ms. Sunita</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
