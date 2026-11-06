import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";

const LEVELS = [
  "A1-", "A1+", "A2-", "A2+", "B1-",
  "B1+", "B2-", "B2+", "C1-", "C1+",
];

const DEMO = [
  {
    title: "A Better Commute",
    readingPassage:
      "When Maya moved to a new neighborhood, her journey to work became longer. At first, she drove every day, but traffic made her tired and stressed. One morning, she decided to try the train. The station was a ten-minute walk from her apartment, and the train was usually on time. Maya now listens to podcasts during the journey. She also spends less money on fuel and parking. Although she sometimes drives when she has heavy bags, taking the train has become her usual choice.",
    questions: [
      {
        questionText: "Why did Maya begin looking for another way to travel?",
        options: [
          "Driving in traffic was tiring and stressful.",
          "The train station was too far away.",
          "Her car was too small.",
        ],
        correctAnswerIndex: 0,
        explanation: "The passage says traffic made Maya tired and stressed.",
      },
      {
        questionText: "What does Maya do on the train?",
        options: [
          "She reads work documents.",
          "She listens to podcasts.",
          "She talks to her neighbors.",
        ],
        correctAnswerIndex: 1,
        explanation: "Maya listens to podcasts during her journey.",
      },
      {
        questionText: "When does Maya sometimes drive?",
        options: [
          "When the train is late.",
          "When she is meeting friends.",
          "When she has heavy bags.",
        ],
        correctAnswerIndex: 2,
        explanation: "She sometimes drives when she has heavy bags.",
      },
    ],
  },
];

function shuffleQuestions(items) {
  return items.map((quiz) => ({
    ...quiz,
    questions: quiz.questions.map((question) => {
      const correctOption = question.options[question.correctAnswerIndex];
      const options = [...question.options].sort(() => Math.random() - 0.5);
      return {
        ...question,
        options,
        correctAnswerIndex: options.indexOf(correctOption),
      };
    }),
  }));
}

function getPerformanceLevel(level, percentage) {
  const index = LEVELS.indexOf(level);
  if (percentage >= 90) return level;
  if (percentage >= 75) return LEVELS[Math.max(0, index - 1)];
  if (percentage >= 50) return LEVELS[Math.max(0, index - 2)];
  return "A1-";
}

function App() {
  const [level, setLevel] = useState("B1-");
  const [mode, setMode] = useState("automatic");
  const [topic, setTopic] = useState("");
  const [studentName, setStudentName] = useState("");
  const [group, setGroup] = useState("");
  const [count, setCount] = useState(1);

  const [quizzes, setQuizzes] = useState([]);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [voices, setVoices] = useState([]);
  const [voiceName, setVoiceName] = useState("");
  const [speed, setSpeed] = useState(1);
  const [speaking, setSpeaking] = useState(false);
  const [fontSize, setFontSize] = useState(18);

  const ttsAvailable =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window;

  useEffect(() => {
    if (!ttsAvailable) return;

    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      setVoices(available);
      if (!voiceName && available.length) {
        const preferred =
          available.find((voice) => voice.lang?.toLowerCase().startsWith("en")) ??
          available[0];
        setVoiceName(preferred.name);
      }
    };

    loadVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", loadVoices);

    return () => {
      window.speechSynthesis.removeEventListener?.("voiceschanged", loadVoices);
      window.speechSynthesis.cancel();
    };
  }, [ttsAvailable, voiceName]);

  const score = useMemo(() => {
    let correct = 0;
    const total = quizzes.reduce(
      (sum, quiz) => sum + quiz.questions.length,
      0,
    );

    quizzes.forEach((quiz, quizIndex) => {
      quiz.questions.forEach((question, questionIndex) => {
        if (
          answers[`${quizIndex}_${questionIndex}`] ===
          question.correctAnswerIndex
        ) {
          correct += 1;
        }
      });
    });

    return {
      correct,
      total,
      percentage: total ? Math.round((correct / total) * 100) : 0,
    };
  }, [answers, quizzes]);

  function speak(text) {
    if (!ttsAvailable) {
      setMessage("Text-to-speech is not supported in this browser.");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = voices.find((item) => item.name === voiceName);
    if (voice) utterance.voice = voice;

    utterance.rate = Number(speed);
    utterance.lang = voice?.lang || "en-US";
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => {
      setSpeaking(false);
      setMessage("Audio playback failed. Try another voice.");
    };

    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if (ttsAvailable) window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  async function generateAssessment() {
    setMessage("");

    const safeCount = Number(count);
    if (!Number.isInteger(safeCount) || safeCount < 1 || safeCount > 20) {
      setMessage("Choose a number of texts from 1 to 20.");
      return;
    }

    setBusy(true);

    try {
      /*
       * Demo behavior keeps the app runnable without a secret API key.
       * To connect a content-generation model, call your server endpoint here.
       * Keep provider API keys on the server, not in browser code.
       */
      const data = Array.from({ length: safeCount }, (_, index) => ({
        ...DEMO[index % DEMO.length],
        title:
          index === 0
            ? DEMO[0].title
            : `${DEMO[0].title} — Practice ${index + 1}`,
      }));

      setQuizzes(shuffleQuestions(data));
      setAnswers({});
      setSubmitted(false);
    } catch {
      setMessage("Could not generate the assessment. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function resetPractice() {
    stopSpeaking();
    setQuizzes([]);
    setAnswers({});
    setSubmitted(false);
    setMessage("");
  }

  function downloadExam() {
    if (!quizzes.length) return;

    const pdf = new jsPDF({ format: "letter" });
    let y = 20;
    const margin = 16;
    const width = 178;

    pdf.setFontSize(18);
    pdf.text("English Proficiency Assessment", margin, y);
    y += 9;
    pdf.setFontSize(10);
    pdf.text(`Level: ${level}   Date: ${new Date().toLocaleDateString()}`, margin, y);
    y += 10;
    pdf.text("Name: __________________________   Group: ______________", margin, y);
    y += 12;

    quizzes.forEach((quiz, quizIndex) => {
      if (y > 245) {
        pdf.addPage();
        y = 20;
      }

      pdf.setFontSize(13);
      pdf.setFont("helvetica", "bold");
      pdf.text(`${quizIndex + 1}. ${quiz.title}`, margin, y);
      y += 7;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);

      const passageLines = pdf.splitTextToSize(quiz.readingPassage, width);
      pdf.text(passageLines, margin, y);
      y += passageLines.length * 5 + 5;

      quiz.questions.forEach((question, questionIndex) => {
        const questionLines = pdf.splitTextToSize(
          `${questionIndex + 1}. ${question.questionText}`,
          width,
        );
        pdf.text(questionLines, margin, y);
        y += questionLines.length * 5;

        question.options.forEach((option, optionIndex) => {
          const letter = String.fromCharCode(65 + optionIndex);
          const lines = pdf.splitTextToSize(`${letter}. ${option}`, width - 5);
          pdf.text(`( ) ${lines[0]}`, margin + 3, y);
          y += 5;
          lines.slice(1).forEach((line) => {
            pdf.text(line, margin + 11, y);
            y += 5;
          });
        });

        y += 3;
        if (y > 260) {
          pdf.addPage();
          y = 20;
        }
      });

      y += 6;
    });

    pdf.save(`Assessment_${level}.pdf`);
  }

  function downloadReport() {
    const pdf = new jsPDF({ format: "letter" });
    const assessedLevel = getPerformanceLevel(level, score.percentage);

    pdf.setFontSize(20);
    pdf.text("English Proficiency Report", 20, 24);
    pdf.setFontSize(11);
    pdf.text(`Student: ${studentName || "N/A"}`, 20, 36);
    pdf.text(`Group: ${group || "N/A"}`, 20, 43);
    pdf.text(`Target level: ${level}`, 20, 50);
    pdf.text(`Score: ${score.correct}/${score.total} (${score.percentage}%)`, 20, 62);
    pdf.text(`Assessed level: ${assessedLevel}`, 20, 70);

    let y = 88;
    quizzes.forEach((quiz, index) => {
      const points = quiz.questions.reduce(
        (sum, question, questionIndex) =>
          sum +
          (answers[`${index}_${questionIndex}`] === question.correctAnswerIndex
            ? 1
            : 0),
        0,
      );

      if (y > 265) {
        pdf.addPage();
        y = 24;
      }

      pdf.setFontSize(11);
      pdf.text(`${index + 1}. ${quiz.title} — ${points}/3`, 20, y);
      y += 9;
    });

    const fileName = (studentName || "Student").replace(/[^a-z0-9_-]/gi, "_");
    pdf.save(`Report_${fileName}.pdf`);
  }

  return (
    <main className="app">
      <style>{styles}</style>

      <header className="topbar">
        <div>
          <p className="eyebrow">ESL reading and assessment</p>
          <h1>Proficiency<span>.pro</span></h1>
        </div>
        <span className="top-note">Teacher-ready practice</span>
      </header>

      <section className="panel setup">
        <div className="section-heading">
          <div>
            <p className="eyebrow">01 · Set up</p>
            <h2>Build an assessment</h2>
          </div>
          <span className="badge">CEFR-aligned</span>
        </div>

        <label className="field-label">Target level</label>
        <div className="level-list">
          {LEVELS.map((item) => (
            <button
              key={item}
              className={`level ${level === item ? "selected" : ""}`}
              disabled={submitted}
              onClick={() => setLevel(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="form-grid">
          <label>
            Student name
            <input
              value={studentName}
              disabled={submitted}
              onChange={(event) => setStudentName(event.target.value)}
              placeholder="e.g. Alex Rivera"
            />
          </label>
          <label>
            Group
            <input
              value={group}
              disabled={submitted}
              onChange={(event) => setGroup(event.target.value)}
              placeholder="e.g. B1 Evening"
            />
          </label>
          <label>
            Number of readings
            <input
              type="number"
              min="1"
              max="20"
              value={count}
              disabled={submitted}
              onChange={(event) => setCount(event.target.value)}
            />
          </label>
        </div>

        <div className="mode-tabs" role="tablist" aria-label="Assessment type">
          <button
            className={mode === "automatic" ? "active" : ""}
            onClick={() => setMode("automatic")}
          >
            General assessment
          </button>
          <button
            className={mode === "manual" ? "active" : ""}
            onClick={() => setMode("manual")}
          >
            Specific topic
          </button>
        </div>

        {mode === "manual" && (
          <label className="topic-field">
            Topic
            <input
              value={topic}
              disabled={submitted}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="e.g. travel, health, technology"
            />
          </label>
        )}

        <div className="action-row">
          <button
            className="button primary"
            onClick={generateAssessment}
            disabled={busy || submitted}
          >
            {busy ? "Preparing…" : "Generate assessment"}
          </button>
          {quizzes.length > 0 && !submitted && (
            <button className="button secondary" onClick={downloadExam}>
              Download exam PDF
            </button>
          )}
        </div>

        {message && <p className="notice" role="status">{message}</p>}
        <p className="demo-note">
          This starter runs with sample content. Connect a secure server-side
          generation endpoint to create new passages from the selected level and topic.
        </p>
      </section>

      {quizzes.map((quiz, quizIndex) => (
        <section className="panel reading-card" key={`${quiz.title}-${quizIndex}`}>
          <div className="reading-header">
            <div>
              <p className="eyebrow">Reading {String(quizIndex + 1).padStart(2, "0")}</p>
              <h2>{quiz.title}</h2>
            </div>
            <span className="badge">{level}</span>
          </div>

          <div className="tts-controls">
            <button
              className="button audio-button"
              onClick={() =>
                speaking ? stopSpeaking() : speak(quiz.readingPassage)
              }
              disabled={!ttsAvailable}
              title={ttsAvailable ? "Play or stop reading" : "TTS unavailable"}
            >
              {speaking ? "Stop reading" : "▶ Read aloud"}
            </button>

            <label>
              Voice
              <select
                value={voiceName}
                onChange={(event) => setVoiceName(event.target.value)}
                disabled={!voices.length}
              >
                {voices.length ? (
                  voices.map((voice) => (
                    <option key={`${voice.name}-${voice.lang}`} value={voice.name}>
                      {voice.name} · {voice.lang}
                    </option>
                  ))
                ) : (
                  <option value="">System default</option>
                )}
              </select>
            </label>

            <label className="speed-control">
              Speed <strong>{Number(speed).toFixed(1)}×</strong>
              <input
                type="range"
                min="0.7"
                max="1.3"
                step="0.1"
                value={speed}
                onChange={(event) => setSpeed(event.target.value)}
              />
            </label>

            <div className="font-controls" aria-label="Passage text size">
              <button onClick={() => setFontSize((size) => Math.max(14, size - 2))}>
                A−
              </button>
              <button onClick={() => setFontSize((size) => Math.min(30, size + 2))}>
                A+
              </button>
            </div>
          </div>

          <article className="passage" style={{ fontSize: `${fontSize}px` }}>
            {quiz.readingPassage}
          </article>

          <div className="question-list">
            {quiz.questions.map((question, questionIndex) => {
              const key = `${quizIndex}_${questionIndex}`;
              const selected = answers[key];

              return (
                <div className="question" key={key}>
                  <h3>{questionIndex + 1}. {question.questionText}</h3>
                  <div className="options">
                    {question.options.map((option, optionIndex) => {
                      const isCorrect =
                        submitted &&
                        optionIndex === question.correctAnswerIndex;
                      const isWrong =
                        submitted &&
                        selected === optionIndex &&
                        optionIndex !== question.correctAnswerIndex;

                      return (
                        <button
                          key={option}
                          className={[
                            "option",
                            selected === optionIndex ? "chosen" : "",
                            isCorrect ? "correct" : "",
                            isWrong ? "wrong" : "",
                          ].join(" ")}
                          disabled={submitted}
                          onClick={() =>
                            setAnswers((current) => ({
                              ...current,
                              [key]: optionIndex,
                            }))
                          }
                        >
                          <span>{String.fromCharCode(65 + optionIndex)}</span>
                          {option}
                        </button>
                      );
                    })}
                  </div>
                  {submitted && (
                    <p className="explanation">
                      {question.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {quizzes.length > 0 && !submitted && (
        <button
          className="button submit"
          onClick={() => {
            stopSpeaking();
            setSubmitted(true);
            window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
          }}
        >
          Submit evaluation
        </button>
      )}

      {submitted && (
        <section className="panel results">
          <p className="eyebrow">Assessment complete</p>
          <h2>Your results</h2>
          <div className="score">{score.percentage}<span>%</span></div>
          <p>
            {score.correct} correct out of {score.total} · Assessed level{" "}
            <strong>{getPerformanceLevel(level, score.percentage)}</strong>
          </p>
          <div className="result-actions">
            <button className="button primary" onClick={downloadReport}>
              Download report PDF
            </button>
            <button className="button secondary" onClick={resetPractice}>
              Start new practice
            </button>
          </div>
        </section>
      )}

      <footer>
        Proficiency.pro · Built for accessible, focused English practice
      </footer>
    </main>
  );
}

const styles = `
  :root {
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
    color: #182139;
    background: #f4f6fb;
    font-synthesis: none;
  }
  * { box-sizing: border-box; }
  body { margin: 0; }
  button, input, select { font: inherit; }
  button { cursor: pointer; }
  .app { width: min(960px, calc(100% - 32px)); margin: 0 auto; padding: 34px 0 24px; }
  .topbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; }
  h1 { margin:0; font-size:clamp(28px, 5vw, 42px); letter-spacing:-1.8px; }
  h1 span { color:#6759e8; }
  h2 { margin:0; letter-spacing:-.6px; }
  .top-note, .badge { color:#6258c9; background:#efedff; padding:8px 12px; border-radius:999px; font-size:12px; font-weight:750; }
  .eyebrow { margin:0 0 7px; color:#7c83a0; font-size:11px; font-weight:800; letter-spacing:1.2px; text-transform:uppercase; }
  .panel { background:#fff; border:1px solid #e8eaf2; border-radius:22px; padding:26px; margin-bottom:18px; box-shadow:0 8px 28px #25315608; }
  .section-heading, .reading-header { display:flex; justify-content:space-between; align-items:center; gap:14px; margin-bottom:24px; }
  .field-label, label { display:block; color:#59617a; font-size:12px; font-weight:750; }
  .level-list { display:flex; flex-wrap:wrap; gap:8px; margin:10px 0 22px; }
  .level { border:0; border-radius:10px; padding:10px 13px; background:#f1f2f7; color:#666d82; font-size:12px; font-weight:800; }
  .level.selected { background:#6559dc; color:white; box-shadow:0 5px 12px #6559dc35; }
  .level:disabled { cursor:not-allowed; }
  .form-grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; margin-bottom:20px; }
  input:not([type=range]), select { display:block; width:100%; margin-top:7px; padding:12px 13px; border:1px solid #e6e8f0; border-radius:11px; outline:none; color:#28304a; background:#fbfcfe; }
  input:focus, select:focus { border-color:#8279e8; box-shadow:0 0 0 3px #8279e81c; }
  .mode-tabs { display:flex; padding:4px; border-radius:13px; background:#f2f3f8; margin-bottom:16px; }
  .mode-tabs button { flex:1; border:0; border-radius:10px; padding:11px; color:#747a8f; background:transparent; font-size:13px; font-weight:750; }
  .mode-tabs .active { color:#5f54d0; background:white; box-shadow:0 2px 7px #1f2b4b0d; }
  .topic-field { margin-bottom:15px; }
  .action-row, .result-actions { display:flex; gap:10px; margin-top:18px; }
  .button { border:0; border-radius:12px; padding:13px 17px; font-weight:750; transition:.15s ease; }
  .button:disabled { opacity:.5; cursor:not-allowed; }
  .primary { color:#fff; background:#212945; }
  .primary:hover { background:#6559dc; }
  .secondary { color:#454d65; background:#f0f1f6; }
  .audio-button { color:#5549c5; background:#efedff; white-space:nowrap; }
  .notice { color:#a33f48; background:#fff0f0; border-radius:10px; padding:10px 12px; }
  .demo-note { color:#8990a4; font-size:12px; line-height:1.5; margin:15px 0 0; }
  .reading-card { padding:26px; }
  .reading-header { margin-bottom:15px; }
  .reading-header h2 { font-size:22px; }
  .tts-controls { display:flex; flex-wrap:wrap; align-items:end; gap:12px; padding:13px; background:#f8f9fc; border-radius:15px; }
  .tts-controls label { min-width:170px; }
  .tts-controls select { margin-top:5px; padding:9px; font-size:12px; }
  .speed-control { display:flex !important; flex-direction:column; gap:5px; min-width:125px !important; }
  .speed-control strong { color:#5f54d0; }
  .speed-control input { width:100%; accent-color:#6559dc; }
  .font-controls { display:flex; gap:5px; margin-left:auto; }
  .font-controls button { border:0; border-radius:8px; padding:9px 11px; color:#555d73; background:#eceef5; font-weight:800; }
  .passage { margin:16px 0 24px; padding:22px; border:1px solid #eceef5; border-radius:16px; background:#fbfcff; color:#414b64; line-height:1.8; }
  .question-list { display:grid; gap:23px; }
  .question h3 { font-size:15px; line-height:1.5; margin:0 0 11px; }
  .options { display:grid; grid-template-columns:repeat(3, 1fr); gap:9px; }
  .option { display:flex; align-items:flex-start; gap:9px; text-align:left; padding:13px; border:1px solid #e7e9f1; border-radius:12px; background:white; color:#515a72; line-height:1.45; }
  .option span { flex:0 0 22px; display:grid; place-items:center; width:22px; height:22px; border-radius:7px; color:#6660bb; background:#f1f0ff; font-size:11px; font-weight:900; }
  .option.chosen { border-color:#766de0; background:#f7f6ff; }
  .option.correct { border-color:#54b786; background:#effaf4; color:#24754d; }
  .option.wrong { border-color:#df7777; background:#fff3f2; color:#9d4545; }
  .explanation { margin:9px 0 0; color:#548268; font-size:13px; }
  .submit { width:100%; margin:5px 0 20px; padding:17px; color:white; background:#6559dc; font-size:15px; }
  .results { text-align:center; padding:34px; }
  .results h2 { font-size:27px; }
  .score { margin:15px 0 5px; color:#6559dc; font-size:64px; font-weight:850; letter-spacing:-3px; }
  .score span { font-size:34px; }
  .results > p:not(.eyebrow) { color:#737b91; }
  .results strong { color:#272f49; }
  .result-actions { justify-content:center; }
  footer { padding:15px 0; color:#969caf; text-align:center; font-size:12px; }
  @media (max-width:700px) {
    .app { width:min(100% - 20px, 600px); padding-top:20px; }
    .panel { padding:18px; border-radius:17px; }
    .form-grid, .options { grid-template-columns:1fr; }
    .top-note { display:none; }
    .tts-controls { align-items:stretch; }
    .tts-controls label { flex:1 1 145px; }
    .font-controls { margin-left:0; }
    .action-row, .result-actions { flex-direction:column; }
    .button { width:100%; }
  }
`;

export default App;