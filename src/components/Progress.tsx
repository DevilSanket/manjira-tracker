import { Download, Music2 } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
export function Progress() {
  const { sessions, completedLessonIds } = useAppStore();
  const exportSessions = () => {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              exportedAt: new Date().toISOString(),
              sessions,
              completedLessonIds,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "manjira-practice-history.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section className="panel progress-panel">
      <div className="section-heading">
        <div>
          <h2>Your practice adds up</h2>
          <p>
            {completedLessonIds.length} lessons completed · {sessions.length}{" "}
            saved sessions
          </p>
        </div>
        <button
          className="button secondary"
          onClick={exportSessions}
          disabled={!sessions.length}
        >
          <Download size={17} />
          Export history
        </button>
      </div>
      {!sessions.length ? (
        <div className="empty-state">
          <Music2 size={34} />
          <h3>Your first session starts here</h3>
          <p>
            Finish a lesson or rhythm practice, or save a studio session. Your
            results will appear here.
          </p>
        </div>
      ) : (
        <div className="history-scroll">
          <table>
            <caption className="sr-only">Saved practice sessions</caption>
            <thead>
              <tr>
                <th scope="col">Practice</th>
                <th scope="col">When</th>
                <th scope="col">Tempo</th>
                <th scope="col">Accuracy</th>
                <th scope="col">Strikes</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id}>
                  <th scope="row">{session.title}</th>
                  <td>
                    {new Intl.DateTimeFormat(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(session.date))}
                  </td>
                  <td>{session.bpm} bpm</td>
                  <td>
                    {session.scoring === "free"
                      ? "Not scored"
                      : `${Math.round(session.accuracy)}%`}
                  </td>
                  <td>
                    {session.strikes ??
                      session.stats.correctType + session.stats.incorrectType}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
