import { db, sanitizeAvatarInput } from '../server/db.js';
import { evaluateAdminAccess } from '../server/routes/room.js';
import { Request } from 'express';
import { Room, ScoreLog, DeductionProposal, Player } from '../src/types';

async function runTests() {
  console.log('====================================================');
  console.log('🚀 RUNNING SYSTEM TEST & SECURITY AUDIT SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  // ==========================================
  // Test Suite 1: Avatar Security & Sanitization
  // ==========================================
  console.log('\n--- 1. Avatar Security & XSS Injection Tests ---');
  
  // 1.1 Safe emoji avatar
  const emojiAvatar = sanitizeAvatarInput('🦊');
  assert(emojiAvatar === '🦊', 'Accept valid emoji avatar (🦊)');

  // 1.2 SVG injection payload
  const svgPayload = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxzY3JpcHQ+YWxlcnQoMSk8L3NjcmlwdD48L3N2Zz4=';
  assert(sanitizeAvatarInput(svgPayload) === undefined, 'Block dangerous SVG with script injection');

  // 1.3 HTML/Script string injection
  const scriptPayload = '<script>alert("XSS")</script>';
  // Scripts > 10 chars are blocked because they don't match data:image/jpeg/png
  assert(sanitizeAvatarInput(scriptPayload) === undefined, 'Block standard HTML/Script tag injection');

  // 1.4 Valid Base64 PNG image
  const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  assert(sanitizeAvatarInput(validPng) === validPng, 'Allow safe Base64 PNG raster image');

  // 1.5 Excessive size payload (> 80KB)
  const hugePayload = 'data:image/png;base64,' + 'A'.repeat(90000);
  assert(sanitizeAvatarInput(hugePayload) === undefined, 'Block oversized base64 payload (>80KB)');


  // ==========================================
  // Test Suite 2: Admin Access & IP Control
  // ==========================================
  console.log('\n--- 2. Internal IP Restriction & Admin Access Tests ---');

  // 2.1 Localhost IPv4
  const reqLocalhostV4 = {
    ip: '127.0.0.1',
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as Request;
  assert(evaluateAdminAccess(reqLocalhostV4).hasAccess === true, 'Allow 127.0.0.1 (Localhost IPv4)');

  // 2.2 Localhost IPv6
  const reqLocalhostV6 = {
    ip: '::1',
    headers: {},
    socket: { remoteAddress: '::1' },
  } as unknown as Request;
  assert(evaluateAdminAccess(reqLocalhostV6).hasAccess === true, 'Allow ::1 (Localhost IPv6)');

  // 2.3 Class A Private Subnet (10.x.x.x)
  const reqPrivate10 = {
    ip: '10.0.4.15',
    headers: {},
    socket: { remoteAddress: '10.0.4.15' },
  } as unknown as Request;
  assert(evaluateAdminAccess(reqPrivate10).hasAccess === true, 'Allow 10.0.4.15 (Class A Private IP)');

  // 2.4 Class C Private Subnet (192.168.x.x)
  const reqPrivate192 = {
    ip: '192.168.1.100',
    headers: {},
    socket: { remoteAddress: '192.168.1.100' },
  } as unknown as Request;
  assert(evaluateAdminAccess(reqPrivate192).hasAccess === true, 'Allow 192.168.1.100 (Class C Private IP)');

  // 2.5 Public External IP (MUST BE BLOCKED)
  const reqPublicIp = {
    ip: '203.0.113.195',
    headers: {},
    socket: { remoteAddress: '203.0.113.195' },
  } as unknown as Request;
  assert(evaluateAdminAccess(reqPublicIp).hasAccess === false, 'Block Public External IP (203.0.113.195)');

  // 2.6 Spoofed X-Forwarded-For with Public Client IP
  const reqSpoofedXFF = {
    ip: '127.0.0.1',
    headers: { 'x-forwarded-for': '198.51.100.44, 10.0.0.1' },
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as Request;
  assert(evaluateAdminAccess(reqSpoofedXFF).hasAccess === false, 'Block External client via X-Forwarded-For');


  // ==========================================
  // Test Suite 3: Room Lifecycle, Scoring & Zero-Sum Logic
  // ==========================================
  console.log('\n--- 3. Room Lifecycle & Scoring Calculations ---');

  // 3.1 Create Room
  const createRes = db.createRoom({
    nickname: '房主小张',
    avatar: '🐼',
    roomTitle: '欢乐麻将积分局',
    mode: 'zero_sum',
    initialScore: 1000,
    retention: 'offline_30s',
  });
  const host = createRes.player;
  const room = createRes.room;
  assert(room.code.length >= 4, 'Create room generates valid room code', `Code: ${room.code}`);
  assert(room.members[host.id].score === 1000, 'Initial host score equals 1000');

  // 3.2 Join Players
  const join2 = db.joinRoom({
    nickname: '玩家小李',
    avatar: '🐱',
    roomCode: room.code,
  }) as { room: Room; token: string; player: Player };
  const p2 = join2.player;

  const join3 = db.joinRoom({
    nickname: '玩家小王',
    avatar: '🐶',
    roomCode: room.code,
  }) as { room: Room; token: string; player: Player };
  const p3 = join3.player;

  const roomAfterJoin = db.getRoom(room.id)!;
  assert(Object.keys(roomAfterJoin.members).length === 3, 'All 3 players successfully joined');

  // 3.3 Score Submission (Zero-sum mode)
  // Host transfers 50 points to p2 and 50 points to p3 (Host: -100, p2: +50, p3: +50)
  const scoreResult = db.submitScore({
    roomId: room.id,
    fromUserId: host.id,
    targetUserIds: [p2.id, p3.id],
    amount: 50,
    note: '发牌/给分',
  }) as { room: Room; newLogs: ScoreLog[] };

  assert(scoreResult.room.members[host.id].score === 900, 'Host score deducted to 900 (-100)');
  assert(scoreResult.room.members[p2.id].score === 1050, 'Player 2 score increased to 1050 (+50)');
  assert(scoreResult.room.members[p3.id].score === 1050, 'Player 3 score increased to 1050 (+50)');

  // Verify Zero-Sum Conservation Law
  const totalScore = Object.values(scoreResult.room.members).reduce((acc, m) => acc + (m as Player).score, 0);
  assert(totalScore === 3000, 'Total score is strictly conserved in Zero-Sum mode (900 + 1050 + 1050 = 3000)');

  // 3.4 Logs recording
  assert(scoreResult.newLogs.length === 2, 'Two separate log entries generated for multi-target action');
  assert(scoreResult.newLogs[0].note === '发牌/给分', 'Log notes persisted accurately');


  // ==========================================
  // Test Suite 4: Deduction Consent Mechanism
  // ==========================================
  console.log('\n--- 4. Deduction Consent Protocol ---');

  // Create a deduction proposal where p2 wants to deduct 30 points from p3 with consent required
  const propRes = db.createDeductionProposal({
    roomId: room.id,
    fromUserId: p2.id,
    targetUserId: p3.id,
    amount: 30,
    note: '点炮扣分申请',
  }) as { proposal: DeductionProposal; room: Room };
  assert(propRes.proposal.status === 'pending', 'Proposal enters pending state');

  // Target responds: Accept
  const resolveResult = db.respondToDeductionProposal({
    roomId: room.id,
    proposalId: propRes.proposal.id,
    responderUserId: p3.id,
    accepted: true,
  }) as { room: Room; proposal: DeductionProposal; newLog?: ScoreLog };
  assert(resolveResult.proposal.status === 'accepted', 'Proposal marked as accepted');
  assert(resolveResult.room.members[p2.id].score === 1080, 'Proposer credited (+30 to 1080)');
  assert(resolveResult.room.members[p3.id].score === 1020, 'Target debited (-30 to 1020)');


  // ==========================================
  // Test Suite 5: Admin Panel & Dissolution Features
  // ==========================================
  console.log('\n--- 5. Admin Dissolve & Deletion Functionality ---');

  // Test admin get all rooms
  const allRooms = db.getAllRoomsForAdmin();
  assert(allRooms.some((r) => r.id === room.id), 'Admin lists active rooms');

  // Test admin delete/dissolve room
  const deleteRes = db.adminDeleteRoom(room.id, true);
  assert(deleteRes.success === true, 'Admin successfully dissolves/deletes room');
  assert(db.getRoom(room.id) === null, 'Room completely removed from active database');


  // ==========================================
  // Summary
  // ==========================================
  console.log('\n====================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
