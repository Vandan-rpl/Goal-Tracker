import TaskListView from "../../components/TaskListView/TaskListView";
import useTasksAccess from "../../hooks/useTasksAccess";
import { getAllTaskFilterOptions, getAllTasks } from "../../services/taskService";

// Every user's tasks (Business Head; Admin read-only): the task grid with
// filters, one collapsible row per employee. The Business Head can add or
// change CFO's Remarks on any row with Submit. New tasks are assigned from
// the Assign Task page.
const AllTasks = () => {
  const { isBusinessHead } = useTasksAccess();

  return (
    <TaskListView
      title="All Tasks"
      badge="ALL TASKS"
      barSubtitle="Organization overview"
      description={
        isBusinessHead
          ? "Every employee's tasks. Type a CFO's Remark on any task and press Submit to email it to the employee."
          : "Every employee's tasks (view only)."
      }
      footer={`${isBusinessHead ? "Use Assign Task to assign new tasks. " : ""}The Overdue box shows only overdue tasks; click it again to show all.`}
      loadTasks={getAllTasks}
      loadFilterOptions={getAllTaskFilterOptions}
      filterKeys={["project", "department", "employee", "status", "priority"]}
      showEmployee
      groupByEmployee
      cfoEditable
      emptyTitle="No tasks yet."
    />
  );
};

export default AllTasks;
