// src/components/RightDrawerPanel.tsx

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useAppStore } from '../store';
import { flattenProjectTasks, formatCompactPath, type FlatTask } from '../utils/taskTree';
import AccordionSection from './AccordionSection';
import DrawerLogoutFooter from './DrawerLogoutFooter';

type CalendarDay =
    | {
        date: string;
        day: number;
        completedCount: number;
    }
    | null;

const WEEK_DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

export default function RightDrawerPanel() {
    const projects = useAppStore((state) => state.projects);
    const currentProjectId = useAppStore((state) => state.currentProjectId);
    const selectedPath = useAppStore((state) => state.selectedPath);

    const theme = useAppStore((state) => state.theme);
    const toggleTheme = useAppStore((state) => state.toggleTheme);

    const rightPanel = useAppStore((state) => state.rightPanel);
    const drawerGuideStep = useAppStore((state) => state.drawerGuideStep);
    const setDrawerGuideStep = useAppStore((state) => state.setDrawerGuideStep);
    const closeRightPanel = useAppStore((state) => state.closeRightPanel);
    const toggleRightPanelSection = useAppStore(
        (state) => state.toggleRightPanelSection,
    );
    const setRightPanelCalendarMode = useAppStore(
        (state) => state.setRightPanelCalendarMode,
    );

    const selectNode = useAppStore((state) => state.selectNode);
    const updateNodeDueDate = useAppStore((state) => state.updateNodeDueDate);
    const updateNodeCompletedAt = useAppStore(
        (state) => state.updateNodeCompletedAt,
    );
    const updateNodeMemo = useAppStore((state) => state.updateNodeMemo);
    const updateNodeDetailMemo = useAppStore(
        (state) => state.updateNodeDetailMemo,
    );
    const toggleNodePriority = useAppStore((state) => state.toggleNodePriority);
    const setNodeCompletion = useAppStore((state) => state.setNodeCompletion);
    const completeNodeAfterDelay = useAppStore(
        (state) => state.completeNodeAfterDelay,
    );
    const movePriorityTask = useAppStore((state) => state.movePriorityTask);
    const reorderPriorityTasks = useAppStore(
        (state) => state.reorderPriorityTasks,
    );

    const [pendingCompleteIds, setPendingCompleteIds] = useState<Set<string>>(
        () => new Set(),
    );
    const [draggedPriorityId, setDraggedPriorityId] = useState<string | null>(
        null,
    );

    const currentProject = useMemo(
        () => projects.find((project) => project.id === currentProjectId) ?? null,
        [currentProjectId, projects],
    );

    const tasks = useMemo(() => {
        if (!currentProject) return [];
        return flattenProjectTasks(currentProject);
    }, [currentProject]);

    useEffect(() => {
        setPendingCompleteIds((previous) => {
            const activeIds = new Set(
                tasks.filter((task) => !task.node.completed).map((task) => task.node.id),
            );

            const next = new Set<string>();

            previous.forEach((id) => {
                if (activeIds.has(id)) next.add(id);
            });

            return next;
        });
    }, [tasks]);

    const selectedNodeId = selectedPath[selectedPath.length - 1] ?? null;

    const selectedTask = useMemo(() => {
        if (!selectedNodeId) return null;
        return tasks.find((task) => task.node.id === selectedNodeId) ?? null;
    }, [selectedNodeId, tasks]);

    const today = todayDateKey();

    // 「今日が期限」だけでなく、既に期限を過ぎた未完了タスクもここに含める
    // (期限切れタスクが宙に浮いて見えなくなるのを防ぐため)。個々の行では
    // TaskRow側で「期限切れ」か「本日期限」かを判別して表示する
    const todayDueTasks = useMemo(
        () =>
            tasks
                .filter((task) => task.node.dueDate !== null && task.node.dueDate <= today && !task.node.completed)
                .sort(
                    (a, b) =>
                        (a.node.dueDate ?? '').localeCompare(b.node.dueDate ?? '') ||
                        a.node.title.localeCompare(b.node.title, 'ja'),
                ),
        [tasks, today],
    );

    const priorityTasks = useMemo(
        () =>
            tasks
                .filter((task) => task.node.isPriority && !task.node.completed)
                .sort((a, b) => {
                    const orderA = a.node.priorityOrder ?? Number.MAX_SAFE_INTEGER;
                    const orderB = b.node.priorityOrder ?? Number.MAX_SAFE_INTEGER;
                    return (
                        orderA - orderB || a.node.createdAt.localeCompare(b.node.createdAt)
                    );
                }),
        [tasks],
    );

    const weeklyGroups = useMemo(() => {
        const nextSevenDates = Array.from({ length: 7 }, (_, index) => {
            const date = new Date();
            date.setDate(date.getDate() + index);
            return toDateKey(date);
        });

        return nextSevenDates
            .map((date) => ({
                date,
                tasks: tasks
                    .filter((task) => task.node.dueDate === date && !task.node.completed)
                    .sort((a, b) => a.node.title.localeCompare(b.node.title, 'ja')),
            }))
            .filter((group) => group.tasks.length > 0);
    }, [tasks]);

    const handleDelayedComplete = (task: FlatTask) => {
        setPendingCompleteIds((previous) => {
            const next = new Set(previous);
            next.add(task.node.id);
            return next;
        });

        completeNodeAfterDelay(task.projectId, task.node.id, 1800);
    };

    const handleSelectTask = (task: FlatTask) => {
        if (task.projectId === currentProjectId) {
            selectNode(task.node.id);
        }
    };

    return (
        <>
            {/* 背面をクリックしても閉じない（Combo-LABのSideDrawerPanelと同じく、開いたまま
                裏のツリーを操作できるようにする。閉じるのはヘッダーの開閉ボタンのみ） */}
            <aside
                style={{
                    ...styles.drawer,
                    transform: rightPanel.isOpen ? 'translateX(0)' : 'translateX(105%)',
                    pointerEvents: rightPanel.isOpen ? 'auto' : 'none',
                }}
                aria-hidden={!rightPanel.isOpen}
            >
                <header style={styles.drawerHeader}>
                    <div style={styles.drawerTitleGroup}>
                        <h2 style={styles.drawerTitle}>⚡ タスク集中パネル</h2>

                        <button
                            type="button"
                            style={styles.themeToggleButton}
                            onClick={toggleTheme}
                            aria-label={
                                theme === 'dark'
                                    ? 'ライトモードに切り替え'
                                    : 'ダークモードに切り替え'
                            }
                            title={
                                theme === 'dark'
                                    ? 'ライトモードに切り替え'
                                    : 'ダークモードに切り替え'
                            }
                        >
                            {theme === 'dark' ? '🌙' : '☀️'}
                        </button>
                    </div>

                    <button
                        type="button"
                        style={styles.closeButton}
                        onClick={closeRightPanel}
                        aria-label="タスク集中パネルを閉じる"
                    >
                        ×
                    </button>
                </header>

                {!currentProject ? (
                    <div className="drawer-scroll" style={styles.drawerBody}>
                        <div style={styles.emptyBox}>
                            <div style={styles.emptyIcon}>📂</div>
                            <p style={styles.emptyTitle}>プロジェクトが選択されていません</p>
                            <p style={styles.emptyText}>
                                ツリー画面でプロジェクトを開くと、期限・優先タスクを表示できます。
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="drawer-scroll" style={styles.drawerBody}>
                        <SelectedTaskEditor
                            task={selectedTask}
                            onTogglePriority={() => {
                                if (!selectedTask) return;
                                toggleNodePriority(selectedTask.projectId, selectedTask.node.id);
                            }}
                            onChangeDueDate={(dueDate) => {
                                if (!selectedTask) return;
                                updateNodeDueDate(
                                    selectedTask.projectId,
                                    selectedTask.node.id,
                                    dueDate,
                                );
                            }}
                            onChangeCompletedAt={(completedAt) => {
                                if (!selectedTask) return;
                                updateNodeCompletedAt(
                                    selectedTask.projectId,
                                    selectedTask.node.id,
                                    completedAt,
                                );
                            }}
                            onChangeMemo={(memo) => {
                                if (!selectedTask) return;
                                updateNodeMemo(
                                    selectedTask.projectId,
                                    selectedTask.node.id,
                                    memo,
                                );
                            }}
                            onChangeDetailMemo={(detailMemo) => {
                                if (!selectedTask) return;
                                updateNodeDetailMemo(
                                    selectedTask.projectId,
                                    selectedTask.node.id,
                                    detailMemo,
                                );
                            }}
                            onComplete={() => {
                                if (!selectedTask) return;
                                handleDelayedComplete(selectedTask);
                            }}
                            isPending={
                                selectedTask ? pendingCompleteIds.has(selectedTask.node.id) : false
                            }
                        />

                        <AccordionSection
                            title="今日・期限切れのタスク"
                            icon="⏰"
                            count={todayDueTasks.length}
                            isOpen={rightPanel.isTodayDueOpen}
                            onToggle={() => toggleRightPanelSection('isTodayDueOpen')}
                        >
                            {todayDueTasks.length === 0 ? (
                                <EmptyMessage text="今日が期限・期限切れの未完了タスクはありません。" />
                            ) : (
                                <div style={styles.taskList}>
                                    {todayDueTasks.map((task) => (
                                        <TaskRow
                                            key={task.node.id}
                                            task={task}
                                            pending={pendingCompleteIds.has(task.node.id)}
                                            onComplete={() => handleDelayedComplete(task)}
                                            onSelect={() => handleSelectTask(task)}
                                        />
                                    ))}
                                </div>
                            )}
                        </AccordionSection>

                        <AccordionSection
                            title="優先的タスク"
                            icon="🔥"
                            count={priorityTasks.length}
                            isOpen={rightPanel.isPriorityListOpen}
                            onToggle={() => toggleRightPanelSection('isPriorityListOpen')}
                            isGuideTarget={drawerGuideStep === 'priorityInfo'}
                            guideHintText="優先登録したタスクをまとめて確認・並び替えできます"
                            onGuideNext={() => {
                                // カレンダーの説明がスクロールなしで見えるよう、
                                // 見終えた優先的タスクは畳んで縦のスペースを空ける
                                if (rightPanel.isPriorityListOpen) {
                                    toggleRightPanelSection('isPriorityListOpen');
                                }
                                setDrawerGuideStep('calendarInfo');
                            }}
                        >
                            {priorityTasks.length === 0 ? (
                                <EmptyMessage text="優先登録された未完了タスクはありません。" />
                            ) : (
                                <div style={styles.taskList}>
                                    {priorityTasks.map((task, index) => (
                                        <article
                                            key={task.node.id}
                                            style={{
                                                ...styles.priorityItem,
                                                opacity: pendingCompleteIds.has(task.node.id) ? 0.55 : 1,
                                            }}
                                            draggable
                                            onDragStart={() => setDraggedPriorityId(task.node.id)}
                                            onDragOver={(event) => event.preventDefault()}
                                            onDrop={() => {
                                                if (!draggedPriorityId) return;

                                                reorderPriorityTasks(
                                                    task.projectId,
                                                    draggedPriorityId,
                                                    task.node.id,
                                                );

                                                setDraggedPriorityId(null);
                                            }}
                                            onDragEnd={() => setDraggedPriorityId(null)}
                                        >
                                            <div style={styles.priorityRank}>{index + 1}</div>

                                            <div style={styles.priorityContent}>
                                                <label style={styles.checkboxRow}>
                                                    <input
                                                        type="checkbox"
                                                        checked={pendingCompleteIds.has(task.node.id)}
                                                        disabled={pendingCompleteIds.has(task.node.id)}
                                                        onChange={() => handleDelayedComplete(task)}
                                                    />
                                                    <span style={styles.taskTitle}>{task.node.title}</span>
                                                </label>

                                                <div style={styles.taskMeta}>
                                                    {task.node.dueDate
                                                        ? `期限: ${formatDateLabel(task.node.dueDate)}`
                                                        : '期限未設定'}
                                                </div>

                                                <div style={styles.pathText} title={task.pathTitles.join(' / ')}>
                                                    {formatCompactPath(task.pathTitles)}
                                                </div>
                                            </div>

                                            <div style={styles.priorityActions}>
                                                <button
                                                    type="button"
                                                    style={styles.miniButton}
                                                    onClick={() =>
                                                        movePriorityTask(task.projectId, task.node.id, 'up')
                                                    }
                                                    disabled={index === 0}
                                                >
                                                    ↑
                                                </button>

                                                <button
                                                    type="button"
                                                    style={styles.miniButton}
                                                    onClick={() =>
                                                        movePriorityTask(
                                                            task.projectId,
                                                            task.node.id,
                                                            'down',
                                                        )
                                                    }
                                                    disabled={index === priorityTasks.length - 1}
                                                >
                                                    ↓
                                                </button>

                                                <button
                                                    type="button"
                                                    style={styles.miniButton}
                                                    onClick={() => handleSelectTask(task)}
                                                >
                                                    選択
                                                </button>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            )}
                        </AccordionSection>

                        <AccordionSection
                            title="カレンダー"
                            icon="📅"
                            count={tasks.filter((task) => task.node.completedAt).length}
                            isOpen={rightPanel.isCalendarOpen}
                            onToggle={() => toggleRightPanelSection('isCalendarOpen')}
                            isGuideTarget={drawerGuideStep === 'calendarInfo'}
                            guideHintText="週間カレンダーで、直近1週間の期限を一覧できます"
                            onGuideNext={() => setDrawerGuideStep('openPatchNotes')}
                        >
                            <div style={styles.calendarTabs}>
                                <button
                                    type="button"
                                    style={{
                                        ...styles.calendarTab,
                                        ...(rightPanel.calendarMode === 'weekly'
                                            ? styles.calendarTabActive
                                            : {}),
                                    }}
                                    onClick={() => setRightPanelCalendarMode('weekly')}
                                >
                                    週間
                                </button>

                                <button
                                    type="button"
                                    style={{
                                        ...styles.calendarTab,
                                        ...(rightPanel.calendarMode === 'monthly'
                                            ? styles.calendarTabActive
                                            : {}),
                                    }}
                                    onClick={() => setRightPanelCalendarMode('monthly')}
                                >
                                    月間
                                </button>
                            </div>

                            {rightPanel.calendarMode === 'weekly' ? (
                                <WeeklyCalendar
                                    groups={weeklyGroups}
                                    pendingCompleteIds={pendingCompleteIds}
                                    onComplete={handleDelayedComplete}
                                    onSelect={handleSelectTask}
                                />
                            ) : (
                                <MonthlyCalendar
                                    tasks={tasks}
                                    onUncomplete={(task) =>
                                        setNodeCompletion(task.projectId, task.node.id, false)
                                    }
                                    onSelect={handleSelectTask}
                                />
                            )}
                        </AccordionSection>
                    </div>
                )}

                <DrawerLogoutFooter />
            </aside>
        </>
    );
}

function SelectedTaskEditor({
    task,
    isPending,
    onTogglePriority,
    onChangeDueDate,
    onChangeCompletedAt,
    onChangeMemo,
    onChangeDetailMemo,
    onComplete,
}: {
    task: FlatTask | null;
    isPending: boolean;
    onTogglePriority: () => void;
    onChangeDueDate: (dueDate: string | null) => void;
    onChangeCompletedAt: (completedAt: string | null) => void;
    onChangeMemo: (memo: string) => void;
    onChangeDetailMemo: (detailMemo: string) => void;
    onComplete: () => void;
}) {
    const detailMemoRef = useRef<HTMLTextAreaElement>(null);

    // 詳細メモは初期状態を小さくし、入力量に応じて自動で高さが伸びるようにする
    // (resize:verticalによる手動リサイズだと、初期表示のたびに大きな空欄が
    // 目立ってドロワー内の縦スペースを圧迫していた)
    useLayoutEffect(() => {
        const el = detailMemoRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    }, [task?.node.detailMemo, task?.node.id]);

    if (!task) {
        return (
            <section style={styles.selectedBox}>
                <div style={styles.selectedTitle}>選択中タスク</div>
                <p style={styles.emptyText}>ツリー上のノードを選択してください。</p>
            </section>
        );
    }

    return (
        <section style={styles.selectedBox}>
            <div style={styles.selectedHeader}>
                <div style={styles.selectedTitleGroup}>
                    <div style={styles.selectedTitle}>選択中タスク</div>
                    <div style={styles.selectedTaskName}>{task.node.title}</div>
                </div>

                <span
                    style={{
                        ...styles.priorityBadge,
                        opacity: task.node.isPriority ? 1 : 0.45,
                    }}
                >
                    {task.node.isPriority ? '優先中' : '通常'}
                </span>
            </div>

            <div style={styles.selectedControls}>
                {/* 期限・達成日は横に並べて縦のスペースを節約する */}
                <div style={styles.dateRow}>
                    <label style={{ ...styles.inputLabel, flex: 1 }}>
                        期限
                        <input
                            type="date"
                            value={task.node.dueDate ?? ''}
                            style={styles.dateInput}
                            onChange={(event) => onChangeDueDate(event.target.value || null)}
                        />
                    </label>

                    {task.node.completed && (
                        <label style={{ ...styles.inputLabel, flex: 1 }}>
                            達成日
                            <input
                                type="date"
                                value={task.node.completedAt ?? ''}
                                style={styles.dateInput}
                                onChange={(event) =>
                                    onChangeCompletedAt(event.target.value || null)
                                }
                            />
                        </label>
                    )}
                </div>

                <label style={styles.inputLabel}>
                    概要メモ
                    <input
                        type="text"
                        value={task.node.memo}
                        placeholder="概要メモを入力..."
                        style={styles.dateInput}
                        onChange={(event) => onChangeMemo(event.target.value)}
                    />
                </label>

                <label style={styles.inputLabel}>
                    詳細メモ
                    <textarea
                        ref={detailMemoRef}
                        value={task.node.detailMemo}
                        style={styles.detailTextarea}
                        placeholder="具体的な手順・仕様・補足メモを入力..."
                        rows={1}
                        onChange={(event) => onChangeDetailMemo(event.target.value)}
                    />
                </label>

                <div style={styles.selectedButtonGrid}>
                    <button type="button" style={styles.secondaryButton} onClick={onTogglePriority}>
                        {task.node.isPriority ? '優先から外す' : '優先に追加'}
                    </button>

                    {!task.node.completed && (
                        <button
                            type="button"
                            style={styles.completeButton}
                            disabled={isPending}
                            onClick={onComplete}
                        >
                            {isPending ? '完了処理中...' : '完了にする'}
                        </button>
                    )}
                </div>
            </div>
        </section>
    );
}

function TaskRow({
    task,
    pending,
    onComplete,
    onSelect,
}: {
    task: FlatTask;
    pending: boolean;
    onComplete: () => void;
    onSelect: () => void;
}) {
    return (
        <article style={{ ...styles.taskRow, opacity: pending ? 0.55 : 1 }}>
            <label style={styles.checkboxRow}>
                <input
                    type="checkbox"
                    checked={pending}
                    disabled={pending}
                    onChange={onComplete}
                />
                <span style={styles.taskTitle}>{task.node.title}</span>
            </label>

            <div style={styles.taskMeta}>
                {task.node.dueDate && task.node.dueDate < todayDateKey() && (
                    <span style={styles.overdueBadge}>期限切れ</span>
                )}
                {task.node.dueDate
                    ? `期限: ${formatDateLabel(task.node.dueDate)}`
                    : '期限未設定'}
            </div>

            <div style={styles.taskFooter}>
                <span style={styles.pathText} title={task.pathTitles.join(' / ')}>
                    {formatCompactPath(task.pathTitles)}
                </span>

                <button type="button" style={styles.textButton} onClick={onSelect}>
                    選択
                </button>
            </div>
        </article>
    );
}

function WeeklyCalendar({
    groups,
    pendingCompleteIds,
    onComplete,
    onSelect,
}: {
    groups: Array<{ date: string; tasks: FlatTask[] }>;
    pendingCompleteIds: Set<string>;
    onComplete: (task: FlatTask) => void;
    onSelect: (task: FlatTask) => void;
}) {
    if (groups.length === 0) {
        return <EmptyMessage text="直近1週間に期限がある未完了タスクはありません。" />;
    }

    return (
        <div style={styles.weeklyList}>
            {groups.map((group) => (
                <section key={group.date} style={styles.weeklyDay}>
                    <div style={styles.weeklyDayTitle}>
                        {formatDateWithWeekday(group.date)}
                    </div>

                    <div style={styles.taskList}>
                        {group.tasks.map((task) => (
                            <TaskRow
                                key={task.node.id}
                                task={task}
                                pending={pendingCompleteIds.has(task.node.id)}
                                onComplete={() => onComplete(task)}
                                onSelect={() => onSelect(task)}
                            />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}

function MonthlyCalendar({
    tasks,
    onUncomplete,
    onSelect,
}: {
    tasks: FlatTask[];
    onUncomplete: (task: FlatTask) => void;
    onSelect: (task: FlatTask) => void;
}) {
    const [monthCursor, setMonthCursor] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });

    const [selectedDate, setSelectedDate] = useState(todayDateKey());

    const completedCountByDate = useMemo(() => {
        const map = new Map<string, number>();

        tasks.forEach((task) => {
            const date = task.node.completedAt?.slice(0, 10);
            if (!date) return;

            map.set(date, (map.get(date) ?? 0) + 1);
        });

        return map;
    }, [tasks]);

    const calendarCells = useMemo<CalendarDay[]>(() => {
        const year = monthCursor.getFullYear();
        const month = monthCursor.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const cells: CalendarDay[] = [];

        for (let index = 0; index < firstDay; index += 1) {
            cells.push(null);
        }

        for (let day = 1; day <= daysInMonth; day += 1) {
            const date = toDateKey(new Date(year, month, day));

            cells.push({
                date,
                day,
                completedCount: completedCountByDate.get(date) ?? 0,
            });
        }

        return cells;
    }, [completedCountByDate, monthCursor]);

    const selectedCompletedTasks = useMemo(
        () =>
            tasks.filter(
                (task) =>
                    task.node.completed &&
                    task.node.completedAt?.slice(0, 10) === selectedDate,
            ),
        [selectedDate, tasks],
    );

    const moveMonth = (amount: number) => {
        setMonthCursor(
            (current) =>
                new Date(current.getFullYear(), current.getMonth() + amount, 1),
        );
    };

    return (
        <div>
            <div style={styles.monthHeader}>
                <button
                    type="button"
                    style={styles.monthButton}
                    onClick={() => moveMonth(-1)}
                    aria-label="前の月"
                >
                    ‹
                </button>

                <div style={styles.monthTitle}>
                    {monthCursor.getFullYear()}年 {monthCursor.getMonth() + 1}月
                </div>

                <button
                    type="button"
                    style={styles.monthButton}
                    onClick={() => moveMonth(1)}
                    aria-label="次の月"
                >
                    ›
                </button>
            </div>

            <div style={styles.weekLabels}>
                {WEEK_DAY_LABELS.map((label) => (
                    <div key={label} style={styles.weekLabel}>
                        {label}
                    </div>
                ))}
            </div>

            <div style={styles.monthGrid}>
                {calendarCells.map((cell, index) => {
                    if (!cell) {
                        return <div key={`empty-${index}`} style={styles.monthEmptyCell} />;
                    }

                    return (
                        <button
                            key={cell.date}
                            type="button"
                            style={{
                                ...styles.monthCell,
                                ...(selectedDate === cell.date ? styles.monthCellSelected : {}),
                                ...(cell.completedCount > 0 ? styles.monthCellHasCompleted : {}),
                            }}
                            onClick={() => setSelectedDate(cell.date)}
                        >
                            <span>{cell.day}</span>

                            {cell.completedCount > 0 && (
                                <span style={styles.monthCount}>{cell.completedCount}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            <div style={styles.completedListBox}>
                <div style={styles.completedListTitle}>
                    {formatDateLabel(selectedDate)} に達成したタスク
                </div>

                {selectedCompletedTasks.length === 0 ? (
                    <EmptyMessage text="この日に達成したタスクはありません。" />
                ) : (
                    <div style={styles.taskList}>
                        {selectedCompletedTasks.map((task) => (
                            <article key={task.node.id} style={styles.taskRow}>
                                <label style={styles.checkboxRow}>
                                    <input
                                        type="checkbox"
                                        checked
                                        onChange={(event) => {
                                            if (!event.target.checked) {
                                                onUncomplete(task);
                                            }
                                        }}
                                    />

                                    <span style={styles.taskTitle}>{task.node.title}</span>
                                </label>

                                <div style={styles.taskFooter}>
                                    <span style={styles.pathText} title={task.pathTitles.join(' / ')}>
                                        {formatCompactPath(task.pathTitles)}
                                    </span>

                                    <button
                                        type="button"
                                        style={styles.textButton}
                                        onClick={() => onSelect(task)}
                                    >
                                        選択
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function EmptyMessage({ text }: { text: string }) {
    return <p style={styles.emptyMessage}>{text}</p>;
}

function todayDateKey(): string {
    return toDateKey(new Date());
}

function toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function formatDateLabel(dateKey: string): string {
    const [year, month, day] = dateKey.split('-');
    if (!year || !month || !day) return dateKey;

    return `${year}/${Number(month)}/${Number(day)}`;
}

function formatDateWithWeekday(dateKey: string): string {
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const weekday = WEEK_DAY_LABELS[date.getDay()];

    return `${Number(month)}/${Number(day)} (${weekday})`;
}

const styles: Record<string, CSSProperties> = {
    drawer: {
        position: 'fixed',
        top: 0,
        right: 0,
        zIndex: 700,
        width: 'min(420px, 94vw)',
        height: '100vh',
        background: 'linear-gradient(180deg, var(--bg-surface), var(--bg-base))',
        borderLeft: '1px solid var(--border)',
        color: 'var(--text-primary)',
        boxShadow: '-24px 0 70px rgba(0, 0, 0, 0.45)',
        transition: 'transform 220ms ease',
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr) auto',
        overflow: 'hidden',
    },

    drawerHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        minHeight: 50,
        borderBottom: '1px solid var(--border)',
    },

    drawerTitleGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minWidth: 0,
    },

    drawerTitle: {
        margin: 0,
        color: 'var(--text-primary)',
        fontSize: 16,
        fontWeight: 900,
        lineHeight: 1.2,
    },

    themeToggleButton: {
        flex: '0 0 auto',
        width: 28,
        height: 28,
        borderRadius: 9,
        border: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
        cursor: 'pointer',
        fontSize: 14,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
    },

    closeButton: {
        flex: '0 0 auto',
        width: 30,
        height: 30,
        borderRadius: 10,
        border: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
        color: 'var(--text-primary)',
        cursor: 'pointer',
        fontSize: 20,
        lineHeight: 1,
    },

    drawerBody: {
        minHeight: 0,
        minWidth: 0,
        overflowY: 'auto',
        // overflow-yをauto等にすると、overflow-xを明示しない限りブラウザはそちらも
        // auto扱いにする（CSS仕様上の既定挙動）。中の要素がわずかでも幅をはみ出すと
        // ドロワー全体が横スクロール可能になり、他のセクションまで巻き込まれて
        // ずれて見える不具合になっていたため、横方向のはみ出しは常に隠す
        overflowX: 'hidden',
        overscrollBehavior: 'contain',
        padding: 12,
        display: 'grid',
        alignContent: 'start',
        gap: 10,
    },

    selectedBox: {
        border: '1px solid rgba(96, 165, 250, 0.24)',
        borderRadius: 15,
        padding: 11,
        background: 'rgba(37, 99, 235, 0.10)',
    },

    selectedHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: 10,
        alignItems: 'flex-start',
    },

    selectedTitleGroup: {
        minWidth: 0,
    },

    selectedTitle: {
        color: 'var(--accent-blue-text)',
        fontSize: 11,
        fontWeight: 900,
    },

    selectedTaskName: {
        marginTop: 4,
        color: 'var(--text-primary)',
        fontSize: 12,
        fontWeight: 850,
        lineHeight: 1.35,
        overflowWrap: 'anywhere',
    },

    priorityBadge: {
        border: '1px solid rgba(251, 113, 133, 0.42)',
        background: 'rgba(251, 113, 133, 0.14)',
        color: 'var(--accent-rose-text)',
        borderRadius: 999,
        padding: '4px 8px',
        fontSize: 11,
        fontWeight: 900,
        whiteSpace: 'nowrap',
    },

    selectedControls: {
        display: 'grid',
        gap: 8,
        marginTop: 10,
    },

    inputLabel: {
        display: 'grid',
        gap: 5,
        color: 'var(--text-secondary)',
        fontSize: 11,
        fontWeight: 800,
    },

    dateRow: {
        display: 'flex',
        gap: 8,
    },

    dateInput: {
        border: '1px solid var(--border)',
        background: 'var(--bg-base)',
        color: 'var(--text-primary)',
        borderRadius: 10,
        padding: '8px 10px',
        fontSize: 12,
        colorScheme: 'light dark',
    },

    // 初期状態は1行分程度の小さいテキストボックスにし、入力量に応じてJS側
    // (SelectedTaskEditorのuseLayoutEffect)がscrollHeightに合わせて高さを伸ばす。
    // resizeは使わない(自動で伸びるため手動リサイズと競合させない)
    detailTextarea: {
        border: '1px solid var(--border)',
        background: 'var(--bg-base)',
        color: 'var(--text-primary)',
        borderRadius: 10,
        padding: '9px 10px',
        fontSize: 12,
        lineHeight: 1.55,
        resize: 'none',
        minHeight: 34,
        outline: 'none',
        overflow: 'hidden',
    },

    selectedButtonGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
    },

    secondaryButton: {
        border: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
        color: 'var(--text-primary)',
        borderRadius: 10,
        padding: '8px 10px',
        cursor: 'pointer',
        fontSize: 11,
        fontWeight: 850,
    },

    completeButton: {
        border: '1px solid var(--accent-green-border)',
        background: 'var(--accent-green-bg)',
        color: 'var(--accent-green-text)',
        borderRadius: 10,
        padding: '8px 10px',
        cursor: 'pointer',
        fontSize: 11,
        fontWeight: 900,
    },

    taskList: {
        display: 'grid',
        gap: 8,
    },

    taskRow: {
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 9,
        background: 'var(--bg-elevated)',
    },

    checkboxRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        color: 'var(--text-primary)',
        fontSize: 13,
        fontWeight: 850,
        lineHeight: 1.4,
    },

    taskTitle: {
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },

    taskMeta: {
        marginTop: 5,
        color: 'var(--text-secondary)',
        fontSize: 11,
    },

    overdueBadge: {
        display: 'inline-block',
        marginRight: 6,
        padding: '1px 6px',
        borderRadius: 999,
        border: '1px solid var(--accent-rose-border)',
        background: 'var(--accent-rose-bg)',
        color: 'var(--accent-rose-text)',
        fontSize: 10,
        fontWeight: 900,
    },

    taskFooter: {
        marginTop: 7,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
    },

    pathText: {
        // white-space:nowrapなテキストはflexアイテムの自動最小幅（min-width:auto）が
        // 内容の全幅になり、overflow/text-overflowを付けていても実際には縮まず横に
        // はみ出してしまう。minWidth:0で明示的に上書きすることで、隣のボタンを
        // 押し出さずにこの中で省略記号（…）に切り詰められるようにする
        minWidth: 0,
        color: 'var(--text-muted)',
        fontSize: 11,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },

    textButton: {
        flexShrink: 0,
        border: 0,
        background: 'transparent',
        color: 'var(--accent-blue-text)',
        cursor: 'pointer',
        fontSize: 11,
        fontWeight: 800,
        whiteSpace: 'nowrap',
    },

    priorityItem: {
        display: 'grid',
        gridTemplateColumns: '30px minmax(0, 1fr) auto',
        gap: 8,
        alignItems: 'center',
        border: '1px solid rgba(251, 113, 133, 0.24)',
        borderRadius: 13,
        padding: 9,
        background: 'rgba(127, 29, 29, 0.12)',
        cursor: 'grab',
    },

    priorityRank: {
        width: 26,
        height: 26,
        display: 'grid',
        placeItems: 'center',
        borderRadius: 9,
        background: 'rgba(251, 113, 133, 0.18)',
        color: 'var(--accent-rose-text)',
        fontSize: 12,
        fontWeight: 950,
    },

    priorityContent: {
        minWidth: 0,
    },

    priorityActions: {
        display: 'grid',
        gap: 4,
    },

    miniButton: {
        border: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
        color: 'var(--text-primary)',
        borderRadius: 8,
        padding: '4px 7px',
        cursor: 'pointer',
        fontSize: 11,
        fontWeight: 800,
    },

    calendarTabs: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
        marginBottom: 10,
    },

    calendarTab: {
        border: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
        color: 'var(--text-muted)',
        borderRadius: 10,
        padding: '8px 10px',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 900,
    },

    calendarTabActive: {
        borderColor: 'rgba(96, 165, 250, 0.42)',
        background: 'rgba(37, 99, 235, 0.18)',
        color: 'var(--accent-blue-text)',
    },

    weeklyList: {
        display: 'grid',
        gap: 10,
    },

    weeklyDay: {
        display: 'grid',
        gap: 7,
    },

    weeklyDayTitle: {
        color: 'var(--accent-amber-text)',
        fontSize: 12,
        fontWeight: 900,
    },

    monthHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 9,
    },

    monthButton: {
        width: 30,
        height: 30,
        borderRadius: 10,
        border: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
        color: 'var(--text-primary)',
        cursor: 'pointer',
        fontSize: 18,
    },

    monthTitle: {
        color: 'var(--text-primary)',
        fontSize: 14,
        fontWeight: 900,
    },

    weekLabels: {
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 5,
        marginBottom: 5,
    },

    weekLabel: {
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: 11,
        fontWeight: 900,
    },

    monthGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 5,
    },

    monthEmptyCell: {
        minHeight: 36,
    },

    monthCell: {
        position: 'relative',
        minHeight: 36,
        borderRadius: 10,
        border: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        fontSize: 12,
    },

    monthCellSelected: {
        borderColor: 'rgba(250, 204, 21, 0.54)',
        background: 'rgba(250, 204, 21, 0.12)',
        color: 'var(--accent-amber-text)',
    },

    monthCellHasCompleted: {
        borderColor: 'rgba(34, 197, 94, 0.38)',
    },

    monthCount: {
        position: 'absolute',
        right: 3,
        bottom: 3,
        minWidth: 15,
        height: 15,
        borderRadius: 999,
        background: '#16a34a',
        color: '#fff',
        fontSize: 10,
        lineHeight: '15px',
        fontWeight: 900,
    },

    completedListBox: {
        marginTop: 12,
        borderTop: '1px solid var(--border)',
        paddingTop: 10,
    },

    completedListTitle: {
        color: 'var(--text-primary)',
        fontSize: 12,
        fontWeight: 900,
        marginBottom: 8,
    },

    emptyBox: {
        padding: 20,
        textAlign: 'center',
        border: '1px dashed var(--border)',
        borderRadius: 16,
        background: 'var(--bg-elevated)',
    },

    emptyIcon: {
        fontSize: 34,
    },

    emptyTitle: {
        margin: '10px 0 0',
        color: 'var(--text-primary)',
        fontWeight: 900,
    },

    emptyText: {
        margin: '8px 0 0',
        color: 'var(--text-secondary)',
        fontSize: 12,
        lineHeight: 1.6,
    },

    emptyMessage: {
        margin: 0,
        color: 'var(--text-muted)',
        fontSize: 12,
        lineHeight: 1.6,
    },
};
