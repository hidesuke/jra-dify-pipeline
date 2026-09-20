import { escapeHtml, htmlPage } from "./html.ts";
import {
  getKickMeetings,
  pickDefaultMeetingDate,
  type WeekMeeting,
} from "./schedules/index.ts";

export interface KickFormOptions {
  todayKey: string;
  error?: string;
  selectedDate?: string;
  selectedVenue?: string;
  selectedRace?: string;
}

export function acceptsHtml(req: Request): boolean {
  return (req.headers.get("Accept") ?? "").includes("text/html");
}

/** ブラウザがクエリ無しで /run を開いたときはフォーム。CLI や ?date= は従来どおり実行。 */
export function wantsKickForm(req: Request): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  if (!acceptsHtml(req)) return false;
  const url = new URL(req.url);
  return !(
    url.searchParams.has("date") ||
    url.searchParams.has("venue") ||
    url.searchParams.has("race") ||
    url.searchParams.get("go") === "1"
  );
}

function raceOptions(selectedRace?: string): string {
  const allSelected = !selectedRace ? " selected" : "";
  const races = Array.from({ length: 12 }, (_, i) => {
    const n = String(i + 1);
    const sel = selectedRace === n ? " selected" : "";
    return `<option value="${n}"${sel}>${n}R</option>`;
  }).join("");
  return `<option value=""${allSelected}>全レース（1〜12R）</option>${races}`;
}

function venueOptions(meeting: WeekMeeting | undefined, selectedVenue?: string): string {
  const allSelected = !selectedVenue ? " selected" : "";
  const venues = (meeting?.venues ?? [])
    .map((v) => {
      const sel = selectedVenue === v.venueCode ? " selected" : "";
      return `<option value="${escapeHtml(v.venueCode)}"${sel}>${escapeHtml(v.venueName)}（${escapeHtml(v.venueCode)}）</option>`;
    })
    .join("");
  return `<option value=""${allSelected}>全ての場</option>${venues}`;
}

function dateOptions(meetings: WeekMeeting[], selectedDate: string): string {
  return meetings
    .map((m) => {
      const sel = m.date === selectedDate ? " selected" : "";
      return `<option value="${escapeHtml(m.date)}"${sel}>${escapeHtml(m.label)}</option>`;
    })
    .join("");
}

function otherLinks(): string {
  return `
  <nav class="links" aria-label="他の機能">
    <a href="/baba/latest?format=text">馬場状態を見る</a>
    <a href="/seed">シード補正</a>
  </nav>`;
}

export function kickFormHtml(options: KickFormOptions): string {
  const meetings = getKickMeetings(options.todayKey);
  const selectedDate = options.selectedDate || pickDefaultMeetingDate(meetings, options.todayKey);
  const meeting = meetings.find((m) => m.date === selectedDate) ?? meetings[0];
  const errorBlock = options.error ? `<p class="error">${escapeHtml(options.error)}</p>` : "";
  const empty =
    meetings.length === 0
      ? `<p class="error">今週の開催がカレンダーにありません。</p>`
      : "";
  const disabled = meetings.length === 0 ? " disabled" : "";
  const meetingsJson = JSON.stringify(meetings).replace(/</g, "\\u003c");

  return `
  <h1>予想を実行</h1>
  <p class="muted">今週の開催から日付・場・レースを選んで Queue に投入します。場とレース番号は空欄ならその日の全候補が対象です。</p>
  ${errorBlock}
  ${empty}
  <form id="kick-form" method="post">
    <label for="date">日付</label>
    <select id="date" name="date" required${disabled}>
      ${dateOptions(meetings, selectedDate)}
    </select>
    <label for="venue">場</label>
    <select id="venue" name="venue"${disabled}>
      ${venueOptions(meeting, options.selectedVenue)}
    </select>
    <label for="race">レース番号</label>
    <select id="race" name="race"${disabled}>
      ${raceOptions(options.selectedRace)}
    </select>
    <p class="summary" id="summary"></p>
    <button type="submit"${disabled}>この内容で実行</button>
  </form>
  ${otherLinks()}
  <script type="application/json" id="kick-meetings">${meetingsJson}</script>
  <script>
    (function () {
      var meetingsEl = document.getElementById("kick-meetings");
      var dateEl = document.getElementById("date");
      var venueEl = document.getElementById("venue");
      var raceEl = document.getElementById("race");
      var summaryEl = document.getElementById("summary");
      var form = document.getElementById("kick-form");
      if (!meetingsEl || !dateEl || !venueEl || !raceEl || !form) return;
      var meetings = [];
      try { meetings = JSON.parse(meetingsEl.textContent || "[]"); } catch (e) { meetings = []; }

      function currentMeeting() {
        var date = dateEl.value;
        for (var i = 0; i < meetings.length; i++) {
          if (meetings[i].date === date) return meetings[i];
        }
        return meetings[0];
      }

      function fillVenues() {
        var meeting = currentMeeting();
        var prev = venueEl.value;
        var html = '<option value="">全ての場</option>';
        var venues = (meeting && meeting.venues) || [];
        for (var i = 0; i < venues.length; i++) {
          var v = venues[i];
          var sel = v.venueCode === prev ? " selected" : "";
          html += '<option value="' + v.venueCode + '"' + sel + ">" + v.venueName + "（" + v.venueCode + "）</option>";
        }
        venueEl.innerHTML = html;
      }

      function updateSummary() {
        if (!summaryEl) return;
        var meeting = currentMeeting();
        if (!meeting) { summaryEl.textContent = ""; return; }
        var venueLabel = "全ての場";
        if (venueEl.value) {
          var venues = meeting.venues || [];
          for (var i = 0; i < venues.length; i++) {
            if (venues[i].venueCode === venueEl.value) {
              venueLabel = venues[i].venueName;
              break;
            }
          }
        }
        var raceLabel = raceEl.value ? raceEl.value + "R" : "全レース";
        summaryEl.textContent = meeting.label.split("）")[0] + "） / " + venueLabel + " / " + raceLabel;
      }

      dateEl.addEventListener("change", function () { fillVenues(); updateSummary(); });
      venueEl.addEventListener("change", updateSummary);
      raceEl.addEventListener("change", updateSummary);
      fillVenues();
      updateSummary();

      form.addEventListener("submit", function (ev) {
        updateSummary();
        var label = summaryEl ? summaryEl.textContent : "";
        if (!window.confirm(label + "\\nキューに投入します。よろしいですか？")) {
          ev.preventDefault();
          return;
        }
        var btn = form.querySelector("button[type=submit]");
        if (btn) {
          btn.disabled = true;
          btn.textContent = "投入中…";
        }
      });
    })();
  </script>
`;
}

export function renderKickForm(options: KickFormOptions, status = 200): Response {
  return htmlPage("予想を実行", kickFormHtml(options), status);
}

export function renderKickResult(params: {
  ok: boolean;
  text: string;
  status?: number;
  error?: string;
}): Response {
  const heading = params.ok ? "キューに投入しました" : "投入できませんでした";
  const status = params.status ?? (params.ok ? 200 : 422);
  const klass = params.ok ? "ok" : "error";
  const lead = params.ok
    ? "Dify への予想は Queue 経由で順次実行されます。"
    : escapeHtml(params.error || "エラーが発生しました。");
  const body = `
  <h1>${heading}</h1>
  <p class="${klass}">${lead}</p>
  <pre>${escapeHtml(params.text)}</pre>
  <p><a class="btn" href="/kick">フォームに戻る</a></p>
  ${otherLinks()}
`;
  return htmlPage(heading, body, status);
}
