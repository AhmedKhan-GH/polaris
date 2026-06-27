# Worktree Parallel Agents

## Problem

Claude Code executes sequentially. You give an instruction, wait for it to finish, then give the next one. If you have 4 independent tasks, you're bottlenecked at 4x the time — even though the tasks don't depend on each other.

## Solution

Use **git worktrees** to create isolated working directories, each on its own feature branch. Run a separate Claude Code session in each worktree. All sessions work in parallel on logically distinct parts of the codebase, then merge cleanly because they don't touch the same files.

## How It Works

```
polaris/                           ← main checkout (your IDE)
.worktrees/
  ├── add-search-filter/           ← worktree: branch feature/add-search-filter
  ├── fix-pagination-bug/          ← worktree: branch feature/fix-pagination-bug
  └── refactor-order-service/      ← worktree: branch feature/refactor-order-service
```

Each worktree is a full working copy sharing the same `.git` history. Branches are independent. Changes don't conflict if scoped correctly.

## Setup

### Create worktrees

```bash
# From project root
git worktree add .worktrees/task-name -b feature/task-name
```

### Run Claude in each

```bash
# Terminal tab 1
cd .worktrees/add-search-filter && claude

# Terminal tab 2
cd .worktrees/fix-pagination-bug && claude

# Terminal tab 3
cd .worktrees/refactor-order-service && claude
```

### Merge when done

```bash
git checkout main
git merge feature/add-search-filter
git merge feature/fix-pagination-bug
git merge feature/refactor-order-service
```

### Cleanup

```bash
git worktree remove .worktrees/task-name
```

## Task Scoping Rules

Parallel tasks **must not overlap on the same files**. Before dispatching:

| Check | Pass? |
|-------|-------|
| Tasks touch different directories/modules | Required |
| No shared utility file edits | Required |
| No competing schema migrations | Required |
| Independent test files | Recommended |

If two tasks need to edit the same file, they must run sequentially — one finishes and merges first, the other rebases on top.

## Scoping Examples

### Parallelizable

| Task A | Task B | Task C |
|--------|--------|--------|
| `app/(dashboard)/(operations)/orders/` | `lib/services/notifications.ts` | `app/(dashboard)/(growth)/` |
| Orders list UI refinements | Notification service | Growth dashboard page |

### NOT parallelizable

| Task A | Task B | Why |
|--------|--------|-----|
| Add column to orders table | Change order status enum | Both touch `lib/schema.ts` |
| Update sidebar nav | Add new route group | Both touch layout/navigation files |

## Orchestration Patterns

### Pattern 1: Manual (you manage sessions)

You open N terminal tabs, create worktrees, paste tasks into each Claude session, and watch them all work. Maximum visibility.

### Pattern 2: Subagent dispatch (Claude manages)

Within a single Claude session, dispatch agents with `isolation: "worktree"`. They run concurrently in isolated worktrees. You see results when they report back. Branches are ready to merge.

### Pattern 3: Hybrid

You take the task requiring the most judgment/interaction. Claude handles the mechanical tasks via subagents. You converge at merge time.

## Workflow

```
1. Identify tasks for the session
2. Check for file overlap → separate into parallel vs sequential
3. Create worktrees for parallel tasks
4. Run Claude in each (or dispatch subagents)
5. Each session: implement → test → commit
6. Review diffs
7. Merge branches
8. Remove worktrees
```

## .gitignore

Add `.worktrees/` to `.gitignore` to prevent accidentally committing worktree contents:

```
# Git worktrees
.worktrees/
```

## Tips

- Keep tasks small and focused — a worktree per feature, not per epic
- Run `npm install` in each worktree after creation (node_modules aren't shared)
- Use descriptive branch names so the git graph is readable
- If a merge conflict occurs, it means the tasks weren't truly independent — resolve manually
- Delete worktrees promptly after merging to avoid stale state
