// Side-effect-only: importing this file registers every feature's queue job
// handler (each registration module calls registerQueueJob at module load).
// Add one import per feature that wants to show up on /admin/queue.
import "@/features/points/services/process-surprise-bonus-jobs"
