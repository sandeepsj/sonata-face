<script lang="ts">
	import { Calendar, Phone, MapPin, FileText, AlertCircle } from 'lucide-svelte';
	import { currentStudentStore } from '$lib';

	$: currentStudentState = $currentStudentStore;
	$: student = currentStudentState.student;

	function formatDate(dateString: string | undefined): string {
		if (!dateString) return 'Not provided';
		try {
			return new Date(dateString).toLocaleDateString('en-IN', {
				year: 'numeric',
				month: 'long',
				day: 'numeric'
			});
		} catch {
			return dateString;
		}
	}
</script>

{#if !student}
	<div class="callout">
		<AlertCircle size={18} strokeWidth={1.6} />
		<div>
			<div class="callout-title">No student data available</div>
		</div>
	</div>
{:else}
	<div class="grid-2" style="grid-template-columns: 2fr 1fr;">
		<div class="col-s">
			<div class="card-s">
				<div class="card-header">
					<div>
						<h3 class="card-title-s">Personal <em style="color: var(--accent); font-style: italic;">details</em></h3>
						<div class="card-sub">Identity and admission</div>
					</div>
				</div>
				<div class="card-body-s">
					<div class="grid-2">
						<div class="field">
							<label>Student name</label>
							<div style="font-size: 14px; color: var(--fg);">{student.studentName || '—'}</div>
						</div>
						<div class="field">
							<label>Admission number</label>
							<div style="font-family: var(--font-mono); font-size: 13px; color: var(--fg);">{student.admissionNo || '—'}</div>
						</div>
						<div class="field">
							<label>Date of birth</label>
							<div style="font-size: 14px; color: var(--fg); display: flex; align-items: center; gap: 6px;">
								<Calendar size={14} strokeWidth={1.6} style="color: var(--fg-muted);" />
								{formatDate(student.dob)}
							</div>
						</div>
						<div class="field">
							<label>Admission date</label>
							<div style="font-size: 14px; color: var(--fg); display: flex; align-items: center; gap: 6px;">
								<Calendar size={14} strokeWidth={1.6} style="color: var(--fg-muted);" />
								{formatDate(student.admissionDate)}
							</div>
						</div>
					</div>
				</div>
			</div>

			<div class="card-s">
				<div class="card-header">
					<div>
						<h3 class="card-title-s">School &amp; <em style="color: var(--accent); font-style: italic;">academics</em></h3>
					</div>
				</div>
				<div class="card-body-s">
					<div class="grid-2">
						<div class="field">
							<label>Class</label>
							<div style="font-size: 14px; color: var(--fg);">{student.className || '—'}</div>
						</div>
						<div class="field">
							<label>School</label>
							<div style="font-size: 14px; color: var(--fg);">{student.school || '—'}</div>
						</div>
					</div>
				</div>
			</div>

			{#if student.remarks}
				<div class="card-s">
					<div class="card-header">
						<div>
							<h3 class="card-title-s">Remarks</h3>
						</div>
					</div>
					<div class="card-body-s">
						<div style="background: var(--bg-elev); padding: 14px; border-radius: 8px; font-size: 13px; line-height: 1.55; white-space: pre-wrap; color: var(--fg-soft);">
							{student.remarks}
						</div>
					</div>
				</div>
			{/if}
		</div>

		<div class="col-s">
			<div class="card-s">
				<div class="card-header">
					<div>
						<h3 class="card-title-s">Contact</h3>
					</div>
				</div>
				<div class="card-body-s">
					<div class="col-s">
						<div class="field">
							<label>Phone</label>
							<div style="display: flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: 13px;">
								<Phone size={13} strokeWidth={1.6} style="color: var(--fg-muted);" />
								{student.contactNo || '—'}
							</div>
						</div>
						<div class="field">
							<label>Pin code</label>
							<div style="display: flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: 13px;">
								<MapPin size={13} strokeWidth={1.6} style="color: var(--fg-muted);" />
								{student.pinCode || '—'}
							</div>
						</div>
						<div class="field">
							<label>Address</label>
							<div style="display: flex; align-items: flex-start; gap: 6px; font-size: 13px; line-height: 1.5;">
								<MapPin size={13} strokeWidth={1.6} style="color: var(--fg-muted); margin-top: 3px;" />
								<span>{student.address || '—'}</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
