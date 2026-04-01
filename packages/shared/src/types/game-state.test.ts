import { describe, it, expectTypeOf } from "vite-plus/test";
import type {
  GameState,
  GamePhase,
  TurnPhase,
  SeatWind,
  CharlestonDirection,
  CharlestonStage,
  CharlestonStatus,
  CharlestonState,
  CharlestonPairing,
  CourtesySubmission,
  PlayerState,
  ActionResult,
  ResolvedAction,
  ExposedGroup,
  GroupIdentity,
  CallWindowState,
} from "./game-state";
import type {
  GameAction,
  StartGameAction,
  CharlestonPassAction,
  CharlestonVoteAction,
  CourtesyPassAction,
  DrawTileAction,
  DiscardTileAction,
} from "./actions";
import type { Tile } from "./tiles";

describe("GameState types", () => {
  it("GamePhase includes all required phases", () => {
    expectTypeOf<"lobby">().toMatchTypeOf<GamePhase>();
    expectTypeOf<"charleston">().toMatchTypeOf<GamePhase>();
    expectTypeOf<"play">().toMatchTypeOf<GamePhase>();
    expectTypeOf<"scoreboard">().toMatchTypeOf<GamePhase>();
    expectTypeOf<"rematch">().toMatchTypeOf<GamePhase>();
  });

  it("TurnPhase includes all required phases", () => {
    expectTypeOf<"draw">().toMatchTypeOf<TurnPhase>();
    expectTypeOf<"discard">().toMatchTypeOf<TurnPhase>();
    expectTypeOf<"callWindow">().toMatchTypeOf<TurnPhase>();
  });

  it("SeatWind includes all four winds", () => {
    expectTypeOf<"east">().toMatchTypeOf<SeatWind>();
    expectTypeOf<"south">().toMatchTypeOf<SeatWind>();
    expectTypeOf<"west">().toMatchTypeOf<SeatWind>();
    expectTypeOf<"north">().toMatchTypeOf<SeatWind>();
  });

  it("PlayerState has required fields", () => {
    expectTypeOf<PlayerState>().toHaveProperty("id");
    expectTypeOf<PlayerState>().toHaveProperty("seatWind");
    expectTypeOf<PlayerState>().toHaveProperty("rack");
    expectTypeOf<PlayerState>().toHaveProperty("exposedGroups");
    expectTypeOf<PlayerState>().toHaveProperty("discardPool");
    expectTypeOf<PlayerState["rack"]>().toMatchTypeOf<Tile[]>();
    expectTypeOf<PlayerState["exposedGroups"]>().toMatchTypeOf<ExposedGroup[]>();
  });

  it("ExposedGroup has type, tiles, and identity fields", () => {
    expectTypeOf<ExposedGroup>().toHaveProperty("type");
    expectTypeOf<ExposedGroup>().toHaveProperty("tiles");
    expectTypeOf<ExposedGroup>().toHaveProperty("identity");
    expectTypeOf<ExposedGroup["tiles"]>().toMatchTypeOf<Tile[]>();
    expectTypeOf<ExposedGroup["identity"]>().toMatchTypeOf<GroupIdentity>();
  });

  it("GroupIdentity has type and optional suit/value/wind/dragon", () => {
    expectTypeOf<GroupIdentity>().toHaveProperty("type");
    expectTypeOf<GroupIdentity["suit"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<GroupIdentity["value"]>().toEqualTypeOf<number | string | undefined>();
    expectTypeOf<GroupIdentity["wind"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<GroupIdentity["dragon"]>().toEqualTypeOf<string | undefined>();
  });

  it("GameState has all required fields", () => {
    expectTypeOf<GameState>().toHaveProperty("gamePhase");
    expectTypeOf<GameState>().toHaveProperty("players");
    expectTypeOf<GameState>().toHaveProperty("wall");
    expectTypeOf<GameState>().toHaveProperty("wallRemaining");
    expectTypeOf<GameState>().toHaveProperty("currentTurn");
    expectTypeOf<GameState>().toHaveProperty("turnPhase");
    expectTypeOf<GameState>().toHaveProperty("lastDiscard");
    expectTypeOf<GameState>().toHaveProperty("callWindow");
    expectTypeOf<GameState>().toHaveProperty("scores");
    expectTypeOf<GameState>().toHaveProperty("gameResult");
    expectTypeOf<GameState>().toHaveProperty("charleston");
  });

  it("GameState.callWindow is CallWindowState or null", () => {
    expectTypeOf<GameState["callWindow"]>().toEqualTypeOf<CallWindowState | null>();
  });

  it("GameState.lastDiscard is tile-discarder pair or null", () => {
    expectTypeOf<GameState["lastDiscard"]>().toEqualTypeOf<{
      tile: Tile;
      discarderId: string;
    } | null>();
  });

  it("ActionResult has accepted and optional reason/resolved", () => {
    expectTypeOf<ActionResult>().toHaveProperty("accepted");
    expectTypeOf<ActionResult["accepted"]>().toEqualTypeOf<boolean>();
    expectTypeOf<ActionResult["reason"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<ActionResult["resolved"]>().toEqualTypeOf<ResolvedAction | undefined>();
  });

  it("Charleston types describe the first and second Charleston flow", () => {
    expectTypeOf<"right">().toMatchTypeOf<CharlestonDirection>();
    expectTypeOf<"across">().toMatchTypeOf<CharlestonDirection>();
    expectTypeOf<"left">().toMatchTypeOf<CharlestonDirection>();
    expectTypeOf<"first">().toMatchTypeOf<CharlestonStage>();
    expectTypeOf<"second">().toMatchTypeOf<CharlestonStage>();
    expectTypeOf<"courtesy">().toMatchTypeOf<CharlestonStage>();
    expectTypeOf<"passing">().toMatchTypeOf<CharlestonStatus>();
    expectTypeOf<"vote-ready">().toMatchTypeOf<CharlestonStatus>();
    expectTypeOf<"courtesy-ready">().toMatchTypeOf<CharlestonStatus>();
    expectTypeOf<CharlestonState>().toHaveProperty("currentDirection");
    expectTypeOf<CharlestonState>().toHaveProperty("activePlayerIds");
    expectTypeOf<CharlestonState>().toHaveProperty("submittedPlayerIds");
    expectTypeOf<CharlestonState>().toHaveProperty("hiddenAcrossTilesByPlayerId");
    expectTypeOf<CharlestonState>().toHaveProperty("votesByPlayerId");
    expectTypeOf<CharlestonState>().toHaveProperty("courtesyPairings");
    expectTypeOf<CharlestonState>().toHaveProperty("courtesySubmissionsByPlayerId");
    expectTypeOf<CharlestonState>().toHaveProperty("courtesyResolvedPairings");
    expectTypeOf<CharlestonState["courtesyPairings"]>().toMatchTypeOf<readonly CharlestonPairing[]>();
    expectTypeOf<CharlestonState["courtesySubmissionsByPlayerId"]>().toMatchTypeOf<
      Partial<Record<string, CourtesySubmission>>
    >();
    expectTypeOf<CharlestonState["courtesyResolvedPairings"]>().toMatchTypeOf<readonly CharlestonPairing[]>();
  });

  it("CourtesySubmission carries count and ordered tile IDs", () => {
    expectTypeOf<CourtesySubmission>().toHaveProperty("count");
    expectTypeOf<CourtesySubmission>().toHaveProperty("tileIds");
    expectTypeOf<CourtesySubmission["tileIds"]>().toMatchTypeOf<readonly string[]>();
  });

  it("ResolvedAction includes courtesy lock and pair-resolution variants", () => {
    expectTypeOf<{
      readonly type: "COURTESY_PASS_LOCKED";
      readonly playerId: string;
      readonly pairing: CharlestonPairing;
    }>().toMatchTypeOf<ResolvedAction>();
    expectTypeOf<{
      readonly type: "COURTESY_PAIR_RESOLVED";
      readonly pairing: CharlestonPairing;
      readonly playerRequests: Record<string, number>;
      readonly appliedCount: number;
      readonly entersPlay: boolean;
    }>().toMatchTypeOf<ResolvedAction>();
  });
});

describe("GameAction types", () => {
  it("StartGameAction has correct shape", () => {
    expectTypeOf<StartGameAction>().toHaveProperty("type");
    expectTypeOf<StartGameAction>().toHaveProperty("playerIds");
    expectTypeOf<StartGameAction["type"]>().toEqualTypeOf<"START_GAME">();
    expectTypeOf<StartGameAction["playerIds"]>().toEqualTypeOf<string[]>();
    expectTypeOf<StartGameAction["seed"]>().toEqualTypeOf<number | undefined>();
  });

  it("GameAction includes StartGameAction", () => {
    expectTypeOf<StartGameAction>().toMatchTypeOf<GameAction>();
  });

  it("GameAction includes DrawTileAction", () => {
    expectTypeOf<DrawTileAction>().toMatchTypeOf<GameAction>();
  });

  it("GameAction includes CharlestonPassAction", () => {
    expectTypeOf<CharlestonPassAction>().toMatchTypeOf<GameAction>();
    expectTypeOf<CharlestonPassAction["tileIds"]>().toEqualTypeOf<readonly string[]>();
  });

  it("GameAction includes CharlestonVoteAction", () => {
    expectTypeOf<CharlestonVoteAction>().toMatchTypeOf<GameAction>();
    expectTypeOf<CharlestonVoteAction["accept"]>().toEqualTypeOf<boolean>();
  });

  it("CourtesyPassAction has correct shape", () => {
    expectTypeOf<CourtesyPassAction>().toHaveProperty("type");
    expectTypeOf<CourtesyPassAction>().toHaveProperty("playerId");
    expectTypeOf<CourtesyPassAction>().toHaveProperty("count");
    expectTypeOf<CourtesyPassAction>().toHaveProperty("tileIds");
    expectTypeOf<CourtesyPassAction["type"]>().toEqualTypeOf<"COURTESY_PASS">();
    expectTypeOf<CourtesyPassAction["tileIds"]>().toMatchTypeOf<readonly string[]>();
  });

  it("GameAction includes CourtesyPassAction", () => {
    expectTypeOf<CourtesyPassAction>().toMatchTypeOf<GameAction>();
  });

  it("GameAction includes DiscardTileAction", () => {
    expectTypeOf<DiscardTileAction>().toMatchTypeOf<GameAction>();
  });
});
