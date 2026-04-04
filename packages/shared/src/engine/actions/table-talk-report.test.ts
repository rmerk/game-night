import { describe, expect, test } from "vite-plus/test";
import { createPlayState } from "../../testing/fixtures";
import { handleDiscardTile } from "./discard";
import { handlePassCall } from "./call-window";
import { handleSocialOverrideRequest } from "./social-override";
import {
  handleTableTalkReport,
  handleTableTalkVote,
  handleTableTalkTimeout,
} from "./table-talk-report";
import { getPlayerBySeat } from "../../testing/helpers";

describe("table talk report (majority dead hand)", () => {
  test("two uphold votes: reported player gets dead hand", () => {
    const state = createPlayState();
    const east = getPlayerBySeat(state, "east");
    const north = getPlayerBySeat(state, "north");
    const south = getPlayerBySeat(state, "south");

    const r = handleTableTalkReport(state, {
      type: "TABLE_TALK_REPORT",
      playerId: south,
      reportedPlayerId: north,
      description: "named a tile",
    });
    expect(r.accepted).toBe(true);
    expect(state.tableTalkReportState?.reportedPlayerId).toBe(north);

    const west = getPlayerBySeat(state, "west");
    const v1 = handleTableTalkVote(state, {
      type: "TABLE_TALK_VOTE",
      playerId: east,
      approve: true,
    });
    expect(v1.accepted).toBe(true);
    expect(state.tableTalkReportState).not.toBeNull();

    const v2 = handleTableTalkVote(state, {
      type: "TABLE_TALK_VOTE",
      playerId: west,
      approve: true,
    });
    expect(v2.accepted).toBe(true);
    expect(state.tableTalkReportState).toBeNull();
    expect(state.players[north]?.deadHand).toBe(true);
    expect(state.tableTalkReportCountsByPlayerId[south]).toBe(1);
  });

  test("two deny votes: denied without dead hand; reporter count increments", () => {
    const state = createPlayState();
    const north = getPlayerBySeat(state, "north");
    const south = getPlayerBySeat(state, "south");

    handleTableTalkReport(state, {
      type: "TABLE_TALK_REPORT",
      playerId: south,
      reportedPlayerId: north,
      description: "first report",
    });

    const nonReporterVoters = Object.keys(state.players).filter((id) => id !== south);
    const [a, b] = nonReporterVoters;
    handleTableTalkVote(state, { type: "TABLE_TALK_VOTE", playerId: a, approve: false });
    const fin = handleTableTalkVote(state, {
      type: "TABLE_TALK_VOTE",
      playerId: b,
      approve: false,
    });
    expect(fin.accepted).toBe(true);
    expect(fin.resolved?.type).toBe("TABLE_TALK_REPORT_RESOLVED");
    expect(state.players[north]?.deadHand).toBe(false);
    expect(state.tableTalkReportCountsByPlayerId[south]).toBe(1);
  });

  test("REPORT_LIMIT_REACHED after two completed reports", () => {
    const state = createPlayState();
    const north = getPlayerBySeat(state, "north");
    const south = getPlayerBySeat(state, "south");
    const west = getPlayerBySeat(state, "west");

    for (let i = 0; i < 2; i++) {
      handleTableTalkReport(state, {
        type: "TABLE_TALK_REPORT",
        playerId: south,
        reportedPlayerId: north,
        description: `r${i}`,
      });
      const [v1, v2] = Object.keys(state.players)
        .filter((id) => id !== south)
        .slice(0, 2);
      handleTableTalkVote(state, { type: "TABLE_TALK_VOTE", playerId: v1, approve: false });
      handleTableTalkVote(state, { type: "TABLE_TALK_VOTE", playerId: v2, approve: false });
      expect(state.tableTalkReportState).toBeNull();
    }

    const third = handleTableTalkReport(state, {
      type: "TABLE_TALK_REPORT",
      playerId: south,
      reportedPlayerId: west,
      description: "blocked",
    });
    expect(third.accepted).toBe(false);
    expect(third.reason).toBe("REPORT_LIMIT_REACHED");
  });

  test("timeout resolves as denied when fewer than 2 approve", () => {
    const state = createPlayState();
    const north = getPlayerBySeat(state, "north");
    const south = getPlayerBySeat(state, "south");

    handleTableTalkReport(state, {
      type: "TABLE_TALK_REPORT",
      playerId: south,
      reportedPlayerId: north,
      description: "timeout case",
    });
    const t = handleTableTalkTimeout(state);
    expect(t.accepted).toBe(true);
    expect(t.resolved?.type).toBe("TABLE_TALK_REPORT_RESOLVED");
    expect(state.tableTalkReportCountsByPlayerId[south]).toBe(1);
  });

  test("invalid reported player rejected", () => {
    const state = createPlayState();
    const south = getPlayerBySeat(state, "south");
    const r = handleTableTalkReport(state, {
      type: "TABLE_TALK_REPORT",
      playerId: south,
      reportedPlayerId: "not-a-player",
      description: "x",
    });
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe("INVALID_REPORTED_PLAYER");
  });

  test("cannot start table talk while social override pending", () => {
    const state = createPlayState();
    const east = getPlayerBySeat(state, "east");
    const south = getPlayerBySeat(state, "south");
    const north = getPlayerBySeat(state, "north");
    const tile = state.players[east].rack.find((t) => t.category !== "joker")!;
    handleDiscardTile(state, { type: "DISCARD_TILE", playerId: east, tileId: tile.id });
    handleSocialOverrideRequest(state, {
      type: "SOCIAL_OVERRIDE_REQUEST",
      playerId: east,
      description: "undo",
    });

    const tr = handleTableTalkReport(state, {
      type: "TABLE_TALK_REPORT",
      playerId: south,
      reportedPlayerId: north,
      description: "talk",
    });
    expect(tr.accepted).toBe(false);
    expect(tr.reason).toBe("SOCIAL_OVERRIDE_PENDING");
  });

  test("cannot start social override while table talk pending", () => {
    const state = createPlayState();
    const east = getPlayerBySeat(state, "east");
    const south = getPlayerBySeat(state, "south");
    const north = getPlayerBySeat(state, "north");
    const tile = state.players[east].rack.find((t) => t.category !== "joker")!;
    handleDiscardTile(state, { type: "DISCARD_TILE", playerId: east, tileId: tile.id });

    handleTableTalkReport(state, {
      type: "TABLE_TALK_REPORT",
      playerId: south,
      reportedPlayerId: north,
      description: "talk",
    });

    const so = handleSocialOverrideRequest(state, {
      type: "SOCIAL_OVERRIDE_REQUEST",
      playerId: east,
      description: "undo",
    });
    expect(so.accepted).toBe(false);
    expect(so.reason).toBe("TABLE_TALK_PENDING");
  });

  test("PASS_CALL blocked while table talk pending", () => {
    const state = createPlayState();
    const east = getPlayerBySeat(state, "east");
    const south = getPlayerBySeat(state, "south");
    const north = getPlayerBySeat(state, "north");
    const west = getPlayerBySeat(state, "west");
    const tile = state.players[east].rack.find((t) => t.category !== "joker")!;
    handleDiscardTile(state, { type: "DISCARD_TILE", playerId: east, tileId: tile.id });

    handleTableTalkReport(state, {
      type: "TABLE_TALK_REPORT",
      playerId: south,
      reportedPlayerId: north,
      description: "talk",
    });

    const pc = handlePassCall(state, { type: "PASS_CALL", playerId: west });
    expect(pc.accepted).toBe(false);
    expect(pc.reason).toBe("TABLE_TALK_PENDING");
  });

  test("reported player may vote deny", () => {
    const state = createPlayState();
    const north = getPlayerBySeat(state, "north");
    const south = getPlayerBySeat(state, "south");

    handleTableTalkReport(state, {
      type: "TABLE_TALK_REPORT",
      playerId: south,
      reportedPlayerId: north,
      description: "accused",
    });

    const east = getPlayerBySeat(state, "east");
    handleTableTalkVote(state, { type: "TABLE_TALK_VOTE", playerId: north, approve: false });
    handleTableTalkVote(state, { type: "TABLE_TALK_VOTE", playerId: east, approve: false });

    expect(state.tableTalkReportState).toBeNull();
    expect(state.players[north]?.deadHand).toBe(false);
  });
});
