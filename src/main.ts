import './style.css'
import {
  estimateWinChances,
  getDefaultMatchupProbabilities,
  simulateMatch,
  type MatchupProbabilities,
  type MatchResult,
  type WinChanceEstimate,
} from './simulation'

const ESTIMATE_SIMULATION_COUNT = 10000
const DEFAULT_MATCHUP_STAT_HTML =
  '<span class="matchup-stats-line">Avg Score: -</span>' +
  '<span class="matchup-stats-line">Avg Matches: -</span>'
const DEFAULT_WIN_SECTION_HTML =
  '<h2>Win Chances</h2>' +
  '<p>Run estimation to compute each team\'s chance of winning.</p>'

function probabilityToSliderValue(teamAProbability: number): number {
  return Math.round((1 - teamAProbability) * 100)
}

function sliderValueToProbability(sliderValue: number): number {
  return (100 - sliderValue) / 100
}

function formatSplitText(teamBPercent: number): string {
  const teamAPercent = 100 - teamBPercent
  return `${teamAPercent}% / ${teamBPercent}%`
}

function setupSliderNumberDisplays(onProbabilityChanged: () => void): void {
  for (let matchup = 1; matchup <= 4; matchup += 1) {
    const slider = document.querySelector<HTMLInputElement>(`#matchup-slider-${matchup}`)
    const output = document.querySelector<HTMLElement>(`#matchup-value-${matchup}`)
    const resetButton = document.querySelector<HTMLButtonElement>(
      `#matchup-reset-${matchup}`,
    )
    if (!slider || !output) {
      continue
    }

    const updateOutput = () => {
      const teamBPercent = Number.parseInt(slider.value, 10)
      output.textContent = formatSplitText(teamBPercent)
    }

    slider.addEventListener('input', updateOutput)
    slider.addEventListener('change', onProbabilityChanged)
    resetButton?.addEventListener('click', () => {
      slider.value = '50'
      updateOutput()
      onProbabilityChanged()
    })
    updateOutput()
  }
}

function getMatchupStatsFromUi(): string[] {
  const matchupStats: string[] = []

  for (let matchup = 1; matchup <= 4; matchup += 1) {
    const stat = document.querySelector<HTMLElement>(`#matchup-stats-${matchup}`)
    matchupStats.push(stat?.innerHTML || DEFAULT_MATCHUP_STAT_HTML)
  }

  return matchupStats
}

function formatWinChanceEstimate(estimate: WinChanceEstimate): string {
  const teamAPercent = estimate.teamAWinProbability * 100
  const teamBPercent = estimate.teamBWinProbability * 100

  return `
    <h2>Win Chances</h2>
    <p>Based on ${ESTIMATE_SIMULATION_COUNT.toLocaleString()} simulated matches.</p>
    <div class="win-line-wrap">
      <div class="win-line-labels">
        <span>Team A favored</span>
        <span>Team B favored</span>
      </div>
      <div class="win-line" aria-hidden="true">
        <span class="win-line-marker" style="left: ${teamBPercent.toFixed(2)}%"></span>
      </div>
    </div>
    <ul>
      <li>
        Team A: ${teamAPercent.toFixed(2)}%
        (${estimate.teamAWinCount.toLocaleString()} wins)
      </li>
      <li>
        Team B: ${teamBPercent.toFixed(2)}%
        (${estimate.teamBWinCount.toLocaleString()} wins)
      </li>
    </ul>
  `
}

function formatMatchupScoreStats(estimate: WinChanceEstimate): string[] {
  return estimate.matchupScoreAverages.map(
    (matchup) =>
      '<span class="matchup-stats-line">' +
      `Avg Score: ${matchup.averageTotalPointsByAPerMatch.toFixed(2)} - ` +
      `${matchup.averageTotalPointsByBPerMatch.toFixed(2)}</span>` +
      '<span class="matchup-stats-line">' +
      `Avg Matches: ${matchup.averageGamesPerMatch.toFixed(2)}</span>`,
  )
}

function formatSingleMatchStats(result: MatchResult): string {
  const pointsByAMatchup = [0, 0, 0, 0]
  const pointsByBMatchup = [0, 0, 0, 0]
  const gamesByMatchup = [0, 0, 0, 0]

  for (const game of result.games) {
    const matchupIndex = game.playerNumber - 1
    pointsByAMatchup[matchupIndex] += game.pointsByA
    pointsByBMatchup[matchupIndex] += game.pointsByB
    gamesByMatchup[matchupIndex] += 1
  }

  return pointsByAMatchup
    .map(
      (_, index) => `
        <div class="single-match-stat-card">
          <h3>Matchup ${index + 1}</h3>
          <span class="matchup-stats-line">
            Score: ${pointsByAMatchup[index]} - ${pointsByBMatchup[index]}
          </span>
          <span class="matchup-stats-line">Matches: ${gamesByMatchup[index]}</span>
        </div>
      `,
    )
    .join('')
}

function formatSingleMatchChart(result: MatchResult): string {
  const width = 640
  const height = 260
  const leftPad = 44
  const rightPad = 12
  const topPad = 12
  const bottomPad = 34
  const chartWidth = width - leftPad - rightPad
  const chartHeight = height - topPad - bottomPad

  const scoresA = [0, ...result.games.map((game) => game.totalAfterGameA)]
  const scoresB = [0, ...result.games.map((game) => game.totalAfterGameB)]
  const maxGameNumber = Math.max(result.games.length, 1)
  const maxScore = Math.max(
    scoresA[scoresA.length - 1],
    scoresB[scoresB.length - 1],
    1,
  )

  const xForGame = (gameNumber: number): number =>
    leftPad + (gameNumber / maxGameNumber) * chartWidth
  const yForScore = (score: number): number =>
    topPad + (1 - score / maxScore) * chartHeight

  const linePointsA = scoresA
    .map((score, gameNumber) => `${xForGame(gameNumber)},${yForScore(score)}`)
    .join(' ')
  const linePointsB = scoresB
    .map((score, gameNumber) => `${xForGame(gameNumber)},${yForScore(score)}`)
    .join(' ')

  const yTicks = [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const score = Math.round(maxScore * ratio)
      const y = yForScore(score)
      return `
        <line
          x1="${leftPad}"
          y1="${y}"
          x2="${width - rightPad}"
          y2="${y}"
          class="chart-grid"
        />
        <text
          x="${leftPad - 8}"
          y="${y + 4}"
          text-anchor="end"
          class="chart-tick"
        >
          ${score}
        </text>
      `
    })
    .join('')

  const xTickStep = Math.max(1, Math.ceil(maxGameNumber / 8))
  const xTicks: string[] = []
  for (let game = 0; game <= maxGameNumber; game += xTickStep) {
    const x = xForGame(game)
    xTicks.push(
      `<text x="${x}" y="${height - 10}" text-anchor="middle" ` +
        `class="chart-tick">${game}</text>`,
    )
  }
  if (maxGameNumber % xTickStep !== 0) {
    const x = xForGame(maxGameNumber)
    xTicks.push(
      `<text x="${x}" y="${height - 10}" text-anchor="middle" ` +
        `class="chart-tick">${maxGameNumber}</text>`,
    )
  }

  return `
    <div class="single-match-chart-wrap">
      <div class="single-match-chart-legend">
        <span><span class="legend-dot legend-dot-a"></span>A</span>
        <span><span class="legend-dot legend-dot-b"></span>B</span>
      </div>
      <svg
        viewBox="0 0 ${width} ${height}"
        class="single-match-chart"
        role="img"
        aria-label="Single match score by game"
      >
        ${yTicks}
        <line
          x1="${leftPad}"
          y1="${height - bottomPad}"
          x2="${width - rightPad}"
          y2="${height - bottomPad}"
          class="chart-axis"
        />
        <line
          x1="${leftPad}"
          y1="${topPad}"
          x2="${leftPad}"
          y2="${height - bottomPad}"
          class="chart-axis"
        />
        <polyline points="${linePointsA}" class="chart-line-a" fill="none" />
        <polyline points="${linePointsB}" class="chart-line-b" fill="none" />
        ${xTicks.join('')}
        <text
          x="${width / 2}"
          y="${height - 2}"
          text-anchor="middle"
          class="chart-label"
        >
          Game
        </text>
        <text
          x="14"
          y="${height / 2}"
          text-anchor="middle"
          transform="rotate(-90 14 ${height / 2})"
          class="chart-label"
        >
          Score
        </text>
      </svg>
    </div>
  `
}

function parseProbabilitiesFromUi(): MatchupProbabilities {
  const parsed: number[] = []

  for (let matchup = 1; matchup <= 4; matchup += 1) {
    const input = document.querySelector<HTMLInputElement>(
      `#matchup-slider-${matchup}`,
    )
    if (!input) {
      throw new Error('Matchup sliders are not available')
    }

    const sliderValue = Number.parseInt(input.value, 10)
    if (
      !Number.isInteger(sliderValue) ||
      sliderValue < 0 ||
      sliderValue > 100
    ) {
      throw new Error(
        `Matchup ${matchup} slider value must be an integer between 0 and 100`,
      )
    }

    const probability = sliderValueToProbability(sliderValue)
    parsed.push(probability)
  }

  return parsed as MatchupProbabilities
}

function setSliderValues(probabilities: MatchupProbabilities): void {
  for (let matchup = 1; matchup <= 4; matchup += 1) {
    const slider = document.querySelector<HTMLInputElement>(
      `#matchup-slider-${matchup}`,
    )
    const output = document.querySelector<HTMLElement>(`#matchup-value-${matchup}`)
    if (!slider) {
      continue
    }

    const teamBPercent = probabilityToSliderValue(probabilities[matchup - 1])
    slider.value = String(teamBPercent)
    if (output) {
      output.textContent = formatSplitText(teamBPercent)
    }
  }
}

function renderMatch(
  result: MatchResult,
  probabilities: MatchupProbabilities,
  winSectionContent = DEFAULT_WIN_SECTION_HTML,
  errorMessage = '',
  matchupStatsContent = [
    DEFAULT_MATCHUP_STAT_HTML,
    DEFAULT_MATCHUP_STAT_HTML,
    DEFAULT_MATCHUP_STAT_HTML,
    DEFAULT_MATCHUP_STAT_HTML,
  ],
): void {
  setSliderValues(probabilities)

  const winSection = document.querySelector<HTMLElement>('#win-results')
  if (winSection) {
    winSection.innerHTML = winSectionContent
  }

  const error = document.querySelector<HTMLElement>('#probability-error')
  if (error) {
    error.textContent = errorMessage
  }

  for (let matchup = 1; matchup <= 4; matchup += 1) {
    const stat = document.querySelector<HTMLElement>(`#matchup-stats-${matchup}`)
    if (!stat) {
      continue
    }

    stat.innerHTML =
      matchupStatsContent[matchup - 1] ?? DEFAULT_MATCHUP_STAT_HTML
  }

  const rows = result.games
    .map(
      (game) => `
        <tr>
          <td>${game.gameNumber}</td>
          <td>Matchup ${game.playerNumber}</td>
          <td>${game.servingAtStart}</td>
          <td>${game.pointsByA}-${game.pointsByB}</td>
          <td>${game.totalAfterGameA}-${game.totalAfterGameB}</td>
          <td>${game.winner}</td>
        </tr>
      `,
    )
    .join('')

  const singleMatchWinner = document.querySelector<HTMLElement>(
    '#single-match-winner',
  )
  if (singleMatchWinner) {
    singleMatchWinner.textContent = `Winner: ${result.winner}`
  }

  const singleMatchScore = document.querySelector<HTMLElement>(
    '#single-match-score',
  )
  if (singleMatchScore) {
    singleMatchScore.textContent =
      `Final Score: Team A ${result.totalA} - ${result.totalB} Team B`
  }

  const singleMatchGames = document.querySelector<HTMLElement>(
    '#single-match-games',
  )
  if (singleMatchGames) {
    singleMatchGames.textContent = `Games Played: ${result.games.length}`
  }

  const singleMatchStats = document.querySelector<HTMLElement>(
    '#single-match-stats-grid',
  )
  if (singleMatchStats) {
    singleMatchStats.innerHTML = formatSingleMatchStats(result)
  }

  const singleMatchChart = document.querySelector<HTMLElement>(
    '#single-match-chart',
  )
  if (singleMatchChart) {
    singleMatchChart.innerHTML = formatSingleMatchChart(result)
  }

  const gameResultsBody = document.querySelector<HTMLElement>(
    '#game-results-body',
  )
  if (gameResultsBody) {
    gameResultsBody.innerHTML = rows
  }
}

let currentResult: MatchResult
let currentProbabilities: MatchupProbabilities

const runWinEstimationUpdate = () => {
  try {
    const nextProbabilities = parseProbabilitiesFromUi()
    const winEstimate = estimateWinChances(
      ESTIMATE_SIMULATION_COUNT,
      nextProbabilities,
    )
    const winEstimateContent = formatWinChanceEstimate(winEstimate)
    const matchupStatsContent = formatMatchupScoreStats(winEstimate)
    renderMatch(
      currentResult,
      nextProbabilities,
      winEstimateContent,
      '',
      matchupStatsContent,
    )
  } catch (error) {
    const errorText =
      error instanceof Error ? error.message : 'Invalid probabilities'
    renderMatch(
      currentResult,
      currentProbabilities,
      document.querySelector<HTMLElement>('#win-results')?.innerHTML ??
        DEFAULT_WIN_SECTION_HTML,
      errorText,
      getMatchupStatsFromUi(),
    )
  }
}

function initializeApp(): void {
  const defaultProbabilities = getDefaultMatchupProbabilities()
  currentProbabilities = defaultProbabilities
  currentResult = simulateMatch(defaultProbabilities)

  setupSliderNumberDisplays(runWinEstimationUpdate)

  const simulateButton = document.querySelector<HTMLButtonElement>('#simulate')
  simulateButton?.addEventListener('click', () => {
    try {
      const nextProbabilities = parseProbabilitiesFromUi()
      const nextResult = simulateMatch(nextProbabilities)
      currentResult = nextResult
      currentProbabilities = nextProbabilities
      renderMatch(
        currentResult,
        currentProbabilities,
        document.querySelector<HTMLElement>('#win-results')?.innerHTML ??
          DEFAULT_WIN_SECTION_HTML,
        '',
        getMatchupStatsFromUi(),
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Invalid probabilities'
      renderMatch(
        currentResult,
        currentProbabilities,
        document.querySelector<HTMLElement>('#win-results')?.innerHTML ??
          DEFAULT_WIN_SECTION_HTML,
        message,
        getMatchupStatsFromUi(),
      )
    }
  })

  const estimateWinsButton = document.querySelector<HTMLButtonElement>(
    '#estimate-wins',
  )
  estimateWinsButton?.addEventListener('click', runWinEstimationUpdate)

  // Run one match immediately so single-match and game results are populated.
  renderMatch(currentResult, currentProbabilities)

  // Also run an initial estimate so win chances and matchup averages are not blank.
  runWinEstimationUpdate()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp)
} else {
  initializeApp()
}
