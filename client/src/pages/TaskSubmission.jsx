
import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  ExternalLink,
  FileText,
  Info,
  Link2,
  RotateCcw,
  Send,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';

import {
  createSubmission,
  getAssignments,
  getMySubmissions,
  getSubmissionCategories,
  toErrorMessage,
  withdrawSubmission,
} from '../api/client';

import { usePageMeta } from '../components/layout/DashboardLayout.jsx';
import Badge from '../components/common/Badge.jsx';
import Button from '../components/common/Button.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import Input from '../components/common/Input.jsx';
import Skeleton from '../components/common/Skeleton.jsx';
import useCourses from '../hooks/useCourses.js';

/**
 * Task submission.
 *
 * Work is handed in as a Google Drive link rather than a file upload.
 * The student keeps the original and nothing large is stored here.
 */

const STATUS_META = {
  submitted: {
    label: 'Submitted',
    tone: 'neutral',
    icon: Clock,
  },
  under_review: {
    label: 'Under review',
    tone: 'primary',
    icon: Clock,
  },
  accepted: {
    label: 'Completed',
    tone: 'success',
    icon: CheckCircle2,
  },
  needs_revision: {
    label: 'Needs changes',
    tone: 'warning',
    icon: RotateCcw,
  },
};

const SUBMISSION_FILTERS = [
  { value: '', label: 'All' },
  {
    value: 'pending',
    label: 'Awaiting review',
    match: (s) => s === 'submitted' || s === 'under_review',
  },
  {
    value: 'needs_revision',
    label: 'Needs changes',
    match: (s) => s === 'needs_revision',
  },
  {
    value: 'accepted',
    label: 'Completed',
    match: (s) => s === 'accepted',
  },
];

const EMPTY = {
  category: '',
  title: '',
  description: '',
  driveLink: '',
  courseId: '',
  assignmentId: '',
};

const formatDue = (value) =>
  new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function TaskSubmission() {
  const { courses } = useCourses();

  const [categories, setCategories] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');

  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [taskCourse, setTaskCourse] = useState('');
  const [submissionFilter, setSubmissionFilter] = useState('');

  // New state for the task instruction drawer.
  const [selectedTask, setSelectedTask] = useState(null);

  usePageMeta('Task Submission', 'Submit your work for review.');

  const load = () =>
    Promise.all([
      getSubmissionCategories(),
      getMySubmissions(),
      getAssignments().catch(() => []),
    ])
      .then(([meta, mine, tasks]) => {
        setCategories(meta.categories || []);
        setSubmissions(mine);
        setAssignments(tasks);
        setStatus('ready');
      })
      .catch((err) => {
        setLoadError(toErrorMessage(err));
        setStatus('error');
      });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close drawer using Escape key.
  useEffect(() => {
    if (!selectedTask) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedTask(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedTask]);

  const set = (key) => (event) => {
    setForm((prev) => ({
      ...prev,
      [key]: event.target.value,
    }));

    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const created = await createSubmission({
        category: form.category,
        title: form.title,
        description: form.description,
        driveLink: form.driveLink,
        courseId: form.courseId || undefined,
        assignmentId: form.assignmentId || undefined,
      });

      const task = assignments.find(
        (a) => a.id === form.assignmentId
      );

      setSubmissions((prev) => [
        { ...created, assignmentId: task || null },
        ...prev,
      ]);

      if (task) {
        setAssignments((prev) =>
          prev.map((a) =>
            a.id === task.id
              ? {
                  ...a,
                  mySubmission: {
                    status: 'submitted',
                    score: null,
                  },
                }
              : a
          )
        );
      }

      setForm(EMPTY);
      setSuccess(
        'Submitted. Your coordinator can now review it.'
      );
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Prefills the form for a task or resubmission.
   */
  const startSubmission = (patch) => {
    setForm((prev) => ({
      ...prev,
      ...patch,
    }));

    setError('');
    setSuccess('');

    document
      .getElementById('submission-form')
      ?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
  };

  const resubmit = (submission) =>
    startSubmission({
      assignmentId: assignments.some(
        (a) => a.id === submission.assignmentId?._id
      )
        ? submission.assignmentId._id
        : '',
      courseId: submission.courseId?._id || '',
      category: submission.category,
      title: submission.title || '',
      description: '',
      driveLink: '',
    });

  // Course filtering.
  const taskCourses = [
    ...new Map(
      assignments
        .filter((a) => a.courseId)
        .map((a) => [
          a.courseId._id,
          a.courseId.title,
        ])
    ).entries(),
  ];

  const shownTasks = taskCourse
    ? assignments.filter((a) =>
        taskCourse === 'all'
          ? !a.courseId
          : a.courseId?._id === taskCourse
      )
    : assignments;

  // Submission filtering.
  const activeFilter = SUBMISSION_FILTERS.find(
    (f) => f.value === submissionFilter
  );

  const shownSubmissions = activeFilter?.match
    ? submissions.filter((s) =>
        activeFilter.match(s.status)
      )
    : submissions;

  const countFor = (f) =>
    f.match
      ? submissions.filter((s) => f.match(s.status)).length
      : submissions.length;

  const handleWithdraw = async (submission) => {
    if (
      !window.confirm(
        'Withdraw this submission? You can submit it again afterwards.'
      )
    ) {
      return;
    }

    try {
      await withdrawSubmission(submission.id);

      setSubmissions((prev) =>
        prev.filter((s) => s.id !== submission.id)
      );
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  if (status === 'error') {
    return (
      <div role="alert" className="card p-5">
        <p className="text-sm font-semibold text-ink-900">
          Could not load submissions
        </p>

        <p className="mt-1 text-[13px] text-ink-600">
          {loadError}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* Page heading */}
      <div>
        <h2 className="text-xl font-bold text-ink-900">
          Task Submission
        </h2>

        <p className="mt-1 text-sm text-ink-500">
          Share your work as a Google Drive link and your coordinator will review it.
        </p>
      </div>

      {/* Tasks assigned by coordinator */}
      {assignments.length > 0 && (
        <section>

          <div className="flex flex-wrap items-center justify-between gap-3">

            <h3 className="flex items-center gap-2 text-lg font-semibold text-ink-900">
              <CalendarClock
                className="h-5 w-5 text-primary-600"
                aria-hidden="true"
              />
              Your tasks
            </h3>

            {taskCourses.length > 1 && (
              <select
                aria-label="Show tasks for course"
                className="field-input w-auto py-2"
                value={taskCourse}
                onChange={(e) =>
                  setTaskCourse(e.target.value)
                }
              >
                <option value="">All my courses</option>

                {taskCourses.map(([id, title]) => (
                  <option key={id} value={id}>
                    {title}
                  </option>
                ))}

                {assignments.some((a) => !a.courseId) && (
                  <option value="all">
                    General tasks
                  </option>
                )}
              </select>
            )}
          </div>

          <ul className="mt-4 grid gap-3 md:grid-cols-2">

            {shownTasks.map((task) => {
              const overdue =
                task.dueDate &&
                new Date(task.dueDate) < new Date();

              const mine = task.mySubmission;

              const meta = mine
                ? STATUS_META[mine.status] ||
                  STATUS_META.submitted
                : null;

              return (
                <li
                  key={task.id}
                  className="card flex flex-col p-5"
                >

                  <div className="flex flex-wrap items-center gap-2">

                    {task.courseId?.title && (
                      <Badge tone="primary">
                        {task.courseId.title}
                      </Badge>
                    )}

                    {task.dueDate && (
                      <Badge
                        tone={
                          overdue && !mine
                            ? 'error'
                            : 'neutral'
                        }
                        icon={Clock}
                      >
                        {overdue ? 'Was due' : 'Due'}{' '}
                        {formatDue(task.dueDate)}
                      </Badge>
                    )}

                    {meta && (
                      <Badge tone={meta.tone}>
                        {meta.label}
                      </Badge>
                    )}
                  </div>

                  {/* Clicking task title opens instructions */}
                  <button
                    type="button"
                    onClick={() => setSelectedTask(task)}
                    className="mt-2.5 w-fit rounded-sm text-left text-sm font-semibold text-ink-900 transition hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                    aria-label={`View full instructions for ${task.title}`}
                  >
                    {task.title}
                  </button>

                  {task.description && (
                    <p className="mt-1 line-clamp-3 whitespace-pre-line text-[13px] leading-relaxed text-ink-600">
                      {task.description}
                    </p>
                  )}

                  <div className="mt-auto flex items-center justify-between gap-3 pt-4">

                    <span className="text-[12px] text-ink-500">
                      {mine &&
                      mine.score !== null &&
                      mine.score !== undefined
                        ? `Score ${mine.score}/${task.maxScore}`
                        : `Out of ${task.maxScore}`}
                    </span>

                    {mine?.status === 'accepted' ? (
                      <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-emerald-700">
                        <CheckCircle2
                          className="h-4 w-4"
                          aria-hidden="true"
                        />
                        Completed
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">

                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            setSelectedTask(task)
                          }
                        >
                          View instructions
                        </Button>

                        <Button
                          size="sm"
                          variant={
                            mine &&
                            mine.status !== 'needs_revision'
                              ? 'secondary'
                              : 'primary'
                          }
                          onClick={() =>
                            startSubmission({
                              assignmentId: task.id,
                              courseId:
                                task.courseId?._id || '',
                              title:
                                form.title || task.title,
                            })
                          }
                        >
                          {!mine
                            ? 'Submit work'
                            : mine.status === 'needs_revision'
                              ? 'Update & resubmit'
                              : 'Submit again'}
                        </Button>

                      </div>
                    )}
                  </div>
                </li>
              );
            })}

          </ul>
        </section>
      )}

      {/* =========================================================
          NEW FEATURE: RIGHT-SIDE TASK INSTRUCTIONS DRAWER
          Existing submission functionality remains unchanged.
      ========================================================= */}

      {selectedTask && (
        <div
          className="fixed inset-0 z-[100] flex justify-end"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedTask(null);
            }
          }}
        >

          {/* Background overlay */}
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]" />

          {/* Right-side drawer */}
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-instructions-title"
            className="relative z-10 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl"
          >

            {/* Drawer header */}
            <div className="flex items-center justify-between gap-4 border-b border-ink-100 px-5 py-4 sm:px-7">

              <div className="flex min-w-0 items-center gap-3">

                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                  <FileText
                    className="h-5 w-5"
                    aria-hidden="true"
                  />
                </span>

                <div className="min-w-0">

                  <h3
                    id="task-instructions-title"
                    className="text-base font-bold text-ink-900"
                  >
                    Task Instructions
                  </h3>

                  <p className="truncate text-[13px] text-ink-500">
                    {selectedTask.courseId?.title ||
                      'Assignment details'}
                  </p>

                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                aria-label="Close task instructions"
                className="rounded-lg p-2 text-ink-500 transition hover:bg-surface-muted hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <X
                  className="h-5 w-5"
                  aria-hidden="true"
                />
              </button>

            </div>

            {/* Scrollable instruction content */}
            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7">

              {/* Deadline and marks */}
              <div className="mb-5 flex flex-wrap items-center justify-between gap-2">

                {selectedTask.dueDate ? (
                  <Badge
                    tone={
                      new Date(selectedTask.dueDate) <
                        new Date() &&
                      !selectedTask.mySubmission
                        ? 'error'
                        : 'neutral'
                    }
                    icon={Clock}
                  >
                    Due {formatDue(selectedTask.dueDate)}
                  </Badge>
                ) : (
                  <Badge tone="neutral" icon={Clock}>
                    No due date specified
                  </Badge>
                )}

                <Badge tone="primary" icon={Trophy}>
                  Total marks: {selectedTask.maxScore ?? 100}
                </Badge>

              </div>

              {/* Task title */}
              <h4 className="text-lg font-bold leading-snug text-ink-900">
                {selectedTask.title}
              </h4>

              {selectedTask.courseId?.title && (
                <p className="mt-2 text-[13px] font-medium text-primary-700">
                  {selectedTask.courseId.title}
                </p>
              )}

              {/* Full task instructions */}
              <section className="mt-5 rounded-xl border border-primary-100 bg-primary-50/70 p-4">

                <h5 className="flex items-center gap-2 text-sm font-semibold text-ink-900">

                  <Info
                    className="h-4 w-4 text-primary-600"
                    aria-hidden="true"
                  />

                  Task instructions

                </h5>

                {selectedTask.description ? (
                  <div className="mt-2 whitespace-pre-wrap break-words text-[13px] leading-7 text-ink-700">
                    {selectedTask.description}
                  </div>
                ) : (
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-500">
                    No additional instructions have been provided for this task.
                  </p>
                )}

              </section>

              {/* Submission reminder */}
              <section className="mt-5 rounded-xl border border-ink-100 p-4">

                <h5 className="text-sm font-semibold text-ink-900">
                  Submission reminder
                </h5>

                <p className="mt-2 text-[13px] leading-6 text-ink-600">
                  Submit your work using the existing submission form.
                  If you are sharing a Google Drive link, make sure
                  its access is set to Anyone with the link
                  with the Viewer role so your coordinator can review it.
                </p>

              </section>

            </div>

            {/* Fixed drawer footer */}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ink-100 bg-white px-5 py-4 sm:px-7">

              <Button
                variant="secondary"
                onClick={() => setSelectedTask(null)}
              >
                Close
              </Button>

              {selectedTask.mySubmission?.status !==
                'accepted' && (
                <Button
                  onClick={() => {
                    const task = selectedTask;

                    setSelectedTask(null);

                    startSubmission({
                      assignmentId: task.id,
                      courseId:
                        task.courseId?._id || '',
                      title:
                        form.title || task.title,
                    });
                  }}
                >
                  <Send
                    className="h-4 w-4"
                    aria-hidden="true"
                  />
                  Submit work
                </Button>
              )}

            </div>

          </aside>
        </div>
      )}

      {/* =========================================================
          EXISTING SUBMISSION FORM
          Original functionality retained.
      ========================================================= */}

      <section
        id="submission-form"
        className="card scroll-mt-24 p-6"
      >

        <h3 className="flex items-center gap-2 text-base font-semibold text-ink-900">

          <Send
            className="h-4 w-4 text-primary-600"
            aria-hidden="true"
          />

          Submit a task

        </h3>

        <form
          onSubmit={handleSubmit}
          className="mt-5 space-y-4"
        >

          {error && (
            <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">

              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />

              {error}

            </p>
          )}

          {success && (
            <p className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[13px] text-emerald-700">

              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />

              {success}

            </p>
          )}

          {/* Task selection */}
          {assignments.length > 0 && (
            <div>

              <label
                className="field-label"
                htmlFor="submission-task"
              >
                Task (optional)
              </label>

              <select
                id="submission-task"
                className="field-input"
                value={form.assignmentId}
                onChange={(event) => {
                  const task = assignments.find(
                    (a) => a.id === event.target.value
                  );

                  setForm((prev) => ({
                    ...prev,
                    assignmentId: event.target.value,
                    courseId:
                      task?.courseId?._id ||
                      prev.courseId,
                  }));
                }}
              >

                <option value="">
                  Not for a specific task
                </option>

                {assignments.map((task) => (
                  <option
                    key={task.id}
                    value={task.id}
                  >
                    {task.title}
                    {task.dueDate
                      ? ` — due ${formatDue(task.dueDate)}`
                      : ''}
                  </option>
                ))}

              </select>

            </div>
          )}

          {/* Category and course */}
          <div className="grid gap-4 sm:grid-cols-2">

            <div>

              <label
                className="field-label"
                htmlFor="submission-category"
              >
                Category
              </label>

              <select
                id="submission-category"
                required
                className="field-input"
                value={form.category}
                onChange={set('category')}
              >

                <option value="" disabled>
                  Choose a category…
                </option>

                {categories.map((category) => (
                  <option
                    key={category}
                    value={category}
                  >
                    {category}
                  </option>
                ))}

              </select>

            </div>

            <div>

              <label
                className="field-label"
                htmlFor="submission-course"
              >
                Course (optional)
              </label>

              <select
                id="submission-course"
                className="field-input"
                value={form.courseId}
                onChange={set('courseId')}
                disabled={Boolean(
                  assignments.find(
                    (a) => a.id === form.assignmentId
                  )?.courseId
                )}
              >

                <option value="">
                  Not course-specific
                </option>

                {courses
                  .filter((c) => c.hasAccess !== false)
                  .map((course) => (
                    <option
                      key={course._id}
                      value={course._id}
                    >
                      {course.title}
                    </option>
                  ))}

              </select>

            </div>

          </div>

          {/* Submission title */}
          <Input
            label="Title (optional)"
            value={form.title}
            onChange={set('title')}
            maxLength={160}
            placeholder="e.g. Week 3 — Sales dashboard"
          />

          {/* Submission description */}
          <div>

            <label
              className="field-label"
              htmlFor="submission-description"
            >
              Description
            </label>

            <textarea
              id="submission-description"
              required
              maxLength={2000}
              className="field-input min-h-[110px] resize-y"
              value={form.description}
              onChange={set('description')}
              placeholder="Briefly describe what you built, what it covers and anything the reviewer should know."
            />

            <p className="mt-1.5 text-xs text-ink-500">
              {form.description.length}/2000 characters.
            </p>

          </div>

          {/* Google Drive link */}
          <Input
            label="Google Drive link"
            icon={Link2}
            required
            type="url"
            value={form.driveLink}
            onChange={set('driveLink')}
            placeholder="https://drive.google.com/file/d/…"
          />

          {/* Google Drive sharing reminder */}
          <div className="flex items-start gap-2.5 rounded-lg bg-primary-50/70 p-3.5 text-[13px] leading-relaxed text-ink-700">

            <Info
              className="mt-0.5 h-4 w-4 shrink-0 text-primary-600"
              aria-hidden="true"
            />

            <span>

              <strong className="font-semibold text-ink-900">
                Set sharing before you submit.
              </strong>{' '}

              In Drive: <em>Share → General access →</em>{' '}

              <strong className="font-semibold">
                Anyone with the link
              </strong>{' '}

              → role{' '}

              <strong className="font-semibold">
                Viewer
              </strong>.

              A restricted link cannot be opened by your reviewer
              and will be sent back.

            </span>

          </div>

          <Button
            type="submit"
            loading={submitting}
            disabled={submitting}
          >

            <Send
              className="h-4 w-4"
              aria-hidden="true"
            />

            Submit task

          </Button>

        </form>

      </section>

      {/* =========================================================
          EXISTING SUBMISSION HISTORY
      ========================================================= */}

      <section>

        <h3 className="text-lg font-semibold text-ink-900">
          Your submissions
        </h3>

        <p className="mt-1 text-sm text-ink-500">
          {status === 'loading'
            ? 'Loading…'
            : `${submissions.length} ${
                submissions.length === 1
                  ? 'submission'
                  : 'submissions'
              }`}
        </p>

        {/* Submission filters */}
        {submissions.length > 0 && (
          <div
            role="tablist"
            aria-label="Filter your submissions"
            className="mt-3 inline-flex flex-wrap gap-1 rounded-xl bg-primary-50 p-1"
          >

            {SUBMISSION_FILTERS.map((f) => {
              const active =
                f.value === submissionFilter;

              return (
                <button
                  key={f.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() =>
                    setSubmissionFilter(f.value)
                  }
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition ${
                    active
                      ? 'bg-white text-primary-700 shadow-sm'
                      : 'text-primary-900/60 hover:text-primary-800'
                  }`}
                >

                  {f.label}

                  <span className="text-[11px] tabular-nums opacity-70">
                    {countFor(f)}
                  </span>

                </button>
              );
            })}

          </div>
        )}

        {/* Loading state */}
        {status === 'loading' ? (
          <div className="mt-4 space-y-3">

            {Array.from({ length: 2 }, (_, i) => (
              <Skeleton
                key={i}
                className="h-28 rounded-card"
              />
            ))}

          </div>
        ) : submissions.length === 0 ? (

          <EmptyState
            className="mt-4"
            icon={ClipboardList}
            title="Nothing submitted yet"
            description="Use the form above to submit your first task. It will appear here with its review status."
          />

        ) : shownSubmissions.length === 0 ? (

          <p className="mt-4 rounded-card border border-dashed border-ink-200 p-6 text-center text-sm text-ink-500">
            Nothing here — try another filter.
          </p>

        ) : (

          <ul className="mt-4 space-y-3">

            {shownSubmissions.map((submission) => {
              const meta =
                STATUS_META[submission.status] ||
                STATUS_META.submitted;

              const StatusIcon = meta.icon;

              return (
                <li
                  key={submission.id}
                  className="card p-5"
                >

                  <div className="flex flex-wrap items-start justify-between gap-3">

                    <div className="min-w-0">

                      <div className="flex flex-wrap items-center gap-2">

                        <Badge tone="primary">
                          {submission.category}
                        </Badge>

                        <Badge
                          tone={meta.tone}
                          icon={StatusIcon}
                        >
                          {meta.label}
                        </Badge>

                        {submission.courseId?.title && (
                          <Badge tone="neutral">
                            {submission.courseId.title}
                          </Badge>
                        )}

                      </div>

                      {(submission.assignmentId?.title ||
                        submission.title) && (
                        <p className="mt-2.5 text-sm font-semibold text-ink-900">
                          {submission.assignmentId?.title ||
                            submission.title}
                        </p>
                      )}

                      {submission.assignmentId?.title &&
                        submission.title && (
                          <p className="text-[13px] text-ink-700">
                            {submission.title}
                          </p>
                        )}

                      <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-ink-600">
                        {submission.description}
                      </p>

                      <p className="mt-2 text-[11px] text-ink-400">
                        Submitted{' '}
                        {new Date(
                          submission.createdAt
                        ).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>

                    </div>

                    {/* Submission actions */}
                    <div className="flex shrink-0 items-center gap-1.5">

                      <Button
                        href={submission.driveLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="sm"
                        variant="secondary"
                      >
                        Open link

                        <ExternalLink
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                      </Button>

                      {submission.status ===
                        'needs_revision' && (
                        <Button
                          size="sm"
                          onClick={() =>
                            resubmit(submission)
                          }
                        >
                          <RotateCcw
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />

                          Resubmit
                        </Button>
                      )}

                      {submission.status === 'submitted' && (
                        <button
                          type="button"
                          onClick={() =>
                            handleWithdraw(submission)
                          }
                          aria-label="Withdraw this submission"
                          className="rounded-lg p-2 text-ink-400 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                        </button>
                      )}

                    </div>

                  </div>

                  {/* Reviewer feedback */}
                  {(submission.feedback ||
                    (submission.score !== null &&
                      submission.score !== undefined)) && (

                    <div
                      className={`mt-4 rounded-lg p-3.5 ${
                        submission.status === 'needs_revision'
                          ? 'border border-amber-200 bg-amber-50'
                          : 'bg-surface-muted'
                      }`}
                    >

                      <div className="flex items-center justify-between gap-3">

                        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                          {submission.status === 'needs_revision'
                            ? 'Changes requested'
                            : 'Reviewer feedback'}
                        </p>

                        {submission.score !== null &&
                          submission.score !== undefined && (
                            <Badge tone="primary">
                              Score {submission.score}/
                              {submission.assignmentId?.maxScore ||
                                100}
                            </Badge>
                          )}

                      </div>

                      <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-ink-700">
                        {submission.feedback}
                      </p>

                    </div>
                  )}

                </li>
              );
            })}

          </ul>

        )}

      </section>

    </div>
  );
}
