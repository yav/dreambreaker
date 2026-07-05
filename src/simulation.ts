export type Team = 'Team A' | 'Team B'

export interface GameResult {
  gameNumber: number
  playerNumber: number
  winner: Team
  pointsByA: number
  pointsByB: number
  servingAtStart: Team
  servingAtEnd: Team
  totalAfterGameA: number
  totalAfterGameB: number
}

export interface MatchResult {
  winner: Team
  totalA: number
  totalB: number
  games: GameResult[]
}

export interface WinChanceEstimate {
  teamAWinCount: number
  teamBWinCount: number
  teamAWinProbability: number
  teamBWinProbability: number
  matchupScoreAverages: MatchupScoreAverage[]
}

export interface MatchupScoreAverage {
  matchupNumber: number
  averageTotalPointsByAPerMatch: number
  averageTotalPointsByBPerMatch: number
  averageGamesPerMatch: number
}

export type MatchupProbabilities = [number, number, number, number]

const POINTS_PER_GAME = 4
const PLAYERS_PER_TEAM = 4
const WIN_POINTS = 21
const WIN_MARGIN = 2

const DEFAULT_MATCHUP_PROBABILITIES: MatchupProbabilities = [0.5, 0.5, 0.5, 0.5]

function pickPointWinner(teamAWinProbability: number): Team {
  return Math.random() < teamAWinProbability ? 'Team A' : 'Team B'
}

function pickInitialServingTeam(): Team {
  return Math.random() < 0.5 ? 'Team A' : 'Team B'
}

function hasMatchWinner(
  pointsA: number,
  pointsB: number,
  pointWinner: Team,
): boolean {
  const winnerPoints = pointWinner === 'Team A' ? pointsA : pointsB
  const loserPoints = pointWinner === 'Team A' ? pointsB : pointsA

  return winnerPoints >= WIN_POINTS && winnerPoints - loserPoints >= WIN_MARGIN
}

function validateMatchupProbabilities(
  matchupProbabilities: readonly number[],
): asserts matchupProbabilities is MatchupProbabilities {
  if (matchupProbabilities.length !== PLAYERS_PER_TEAM) {
    throw new Error(`Expected ${PLAYERS_PER_TEAM} matchup probabilities`)
  }

  matchupProbabilities.forEach((probability, index) => {
    if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
      throw new Error(
        `Matchup ${index + 1} probability must be a number between 0 and 1`,
      )
    }
  })
}

export function simulateMatch(
  matchupProbabilities: readonly number[] = DEFAULT_MATCHUP_PROBABILITIES,
): MatchResult {
  validateMatchupProbabilities(matchupProbabilities)

  let totalA = 0
  let totalB = 0
  const games: GameResult[] = []
  let gameNumber = 1
  let servingTeam = pickInitialServingTeam()
  let matchWinner: Team | null = null

  while (!matchWinner) {
    const playerNumber = ((gameNumber - 1) % PLAYERS_PER_TEAM) + 1
    const teamAWinProbability = matchupProbabilities[playerNumber - 1]
    let gamePointsA = 0
    let gamePointsB = 0
    const servingAtStart = servingTeam

    for (let i = 0; i < POINTS_PER_GAME; i += 1) {
      const servingAtPointStart = servingTeam
      const pointWinner = pickPointWinner(teamAWinProbability)
      const winnerPointsBeforeRally = pointWinner === 'Team A' ? totalA : totalB
      const pointAwarded =
        winnerPointsBeforeRally < 20 || pointWinner === servingAtPointStart

      if (pointAwarded) {
        if (pointWinner === 'Team A') {
          totalA += 1
          gamePointsA += 1
        } else {
          totalB += 1
          gamePointsB += 1
        }
      }

      if (pointWinner !== servingAtPointStart) {
        servingTeam = pointWinner
      }

      if (pointAwarded && hasMatchWinner(totalA, totalB, pointWinner)) {
        matchWinner = pointWinner
        break
      }
    }

    games.push({
      gameNumber,
      playerNumber,
      winner: gamePointsA >= gamePointsB ? 'Team A' : 'Team B',
      pointsByA: gamePointsA,
      pointsByB: gamePointsB,
      servingAtStart,
      servingAtEnd: servingTeam,
      totalAfterGameA: totalA,
      totalAfterGameB: totalB,
    })

    gameNumber += 1
  }

  return {
    winner: matchWinner,
    totalA,
    totalB,
    games,
  }
}

export function estimateWinChances(
  simulationCount: number,
  matchupProbabilities: readonly number[] = DEFAULT_MATCHUP_PROBABILITIES,
): WinChanceEstimate {
  if (!Number.isInteger(simulationCount) || simulationCount <= 0) {
    throw new Error('simulationCount must be a positive integer')
  }

  validateMatchupProbabilities(matchupProbabilities)

  let teamAWinCount = 0
  let teamBWinCount = 0
  const totalPointsByAMatchup = new Array<number>(PLAYERS_PER_TEAM).fill(0)
  const totalPointsByBMatchup = new Array<number>(PLAYERS_PER_TEAM).fill(0)
  const totalGamesByMatchup = new Array<number>(PLAYERS_PER_TEAM).fill(0)

  for (let i = 0; i < simulationCount; i += 1) {
    const result = simulateMatch(matchupProbabilities)
    const matchPointsByAMatchup = new Array<number>(PLAYERS_PER_TEAM).fill(0)
    const matchPointsByBMatchup = new Array<number>(PLAYERS_PER_TEAM).fill(0)

    for (const game of result.games) {
      const matchupIndex = game.playerNumber - 1
      matchPointsByAMatchup[matchupIndex] += game.pointsByA
      matchPointsByBMatchup[matchupIndex] += game.pointsByB
      totalGamesByMatchup[matchupIndex] += 1
    }

    for (let matchupIndex = 0; matchupIndex < PLAYERS_PER_TEAM; matchupIndex += 1) {
      totalPointsByAMatchup[matchupIndex] += matchPointsByAMatchup[matchupIndex]
      totalPointsByBMatchup[matchupIndex] += matchPointsByBMatchup[matchupIndex]
    }

    if (result.winner === 'Team A') {
      teamAWinCount += 1
    } else {
      teamBWinCount += 1
    }
  }

  const matchupScoreAverages = totalPointsByAMatchup.map((_, index) => ({
    matchupNumber: index + 1,
    averageTotalPointsByAPerMatch: totalPointsByAMatchup[index] / simulationCount,
    averageTotalPointsByBPerMatch: totalPointsByBMatchup[index] / simulationCount,
    averageGamesPerMatch: totalGamesByMatchup[index] / simulationCount,
  }))

  return {
    teamAWinCount,
    teamBWinCount,
    teamAWinProbability: teamAWinCount / simulationCount,
    teamBWinProbability: teamBWinCount / simulationCount,
    matchupScoreAverages,
  }
}

export function getDefaultMatchupProbabilities(): MatchupProbabilities {
  return [...DEFAULT_MATCHUP_PROBABILITIES] as MatchupProbabilities
}