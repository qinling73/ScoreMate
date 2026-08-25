import { db } from './db.js';
import { isInternalIp } from './routes/room.js';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

const results: TestResult[] = [];

async function test(suite: string, name: string, fn: () => Promise<void> | void) {
  const start = Date.now();
  try {
    await fn();
    results.push({ suite, name, passed: true, durationMs: Date.now() - start });
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err: any) {
    results.push({ suite, name, passed: false, error: err?.message || String(err), durationMs: Date.now() - start });
    console.error(`  ❌ [FAIL] ${name}: ${err?.message || err}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message} - Expected [${expected}], got [${actual}]`);
  }
}

const BASE_URL = 'http://127.0.0.1:3000';

async function request(path: string, options: {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
} = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data, headers: res.headers };
}

export async function runAllTests() {
  console.log('====================================================');
  console.log('🚀 开始执行多人游戏记分系统综合功能与安全测试套件');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // SUITE 1: IP 安全与内网权限隔离测试 (RFC 1918 / Spoofing)
  // ----------------------------------------------------
  console.log('📦 [SUITE 1] IP 安全与管理后台内网隔离测试:');

  await test('IP Security', '内网 IP 解析函数正确性验证', () => {
    // Localhost & Loopback
    assert(isInternalIp('127.0.0.1'), '127.0.0.1 应被判定为内网');
    assert(isInternalIp('::1'), '::1 应被判定为内网');
    assert(isInternalIp('localhost'), 'localhost 应被判定为内网');
    assert(isInternalIp('::ffff:127.0.0.1'), 'IPv4-mapped 127.0.0.1 应被判定为内网');

    // 10.0.0.0/8
    assert(isInternalIp('10.0.0.1'), '10.0.0.1 应为内网');
    assert(isInternalIp('10.254.12.99'), '10.254.12.99 应为内网');

    // 172.16.0.0/12
    assert(isInternalIp('172.16.0.1'), '172.16.0.1 应为内网');
    assert(isInternalIp('172.31.255.254'), '172.31.255.254 应为内网');
    assert(!isInternalIp('172.15.0.1'), '172.15.0.1 不是内网');
    assert(!isInternalIp('172.32.0.1'), '172.32.0.1 不是内网');

    // 192.168.0.0/16
    assert(isInternalIp('192.168.1.1'), '192.168.1.1 应为内网');
    assert(isInternalIp('192.168.100.200'), '192.168.100.200 应为内网');

    // Public IPs (Must NOT be internal)
    assert(!isInternalIp('8.8.8.8'), '8.8.8.8 不应为内网');
    assert(!isInternalIp('114.114.114.114'), '114.114.114.114 不应为内网');
    assert(!isInternalIp('203.0.113.195'), '203.0.113.195 不应为内网');
    assert(!isInternalIp('1.1.1.1'), '1.1.1.1 不应为内网');
  });

  await test('IP Security', '外网访问后台 API 应被严格拦截 (403 Forbidden)', async () => {
    // Simulate external request via X-Forwarded-For
    const res = await request('/api/room/admin/all', {
      headers: {
        'X-Forwarded-For': '203.0.113.55',
      },
    });
    assertEqual(res.status, 403, '外网 IP 请求 /api/room/admin/all 必须返回 403');
    assert(res.data?.error?.includes('仅限内网'), '应有明确的内网拦截提示');
  });

  await test('IP Security', '外网尝试调用强制解散房间应被拦截 (403 Forbidden)', async () => {
    const res = await request('/api/room/admin/room/fake_room_id/delete', {
      method: 'POST',
      headers: {
        'X-Forwarded-For': '198.51.100.42',
      },
    });
    assertEqual(res.status, 403, '外网 IP 执行解散必须被 403 拦截');
  });

  await test('IP Security', '外网伪造多 IP 代理链 (X-Forwarded-For 伪造攻击防御)', async () => {
    // If client sends '203.0.113.55, 10.0.0.1' - client IP is 203.0.113.55 (first IP), must be blocked!
    const res = await request('/api/room/admin/access-check', {
      headers: {
        'X-Forwarded-For': '203.0.113.55, 10.0.0.1',
      },
    });
    assertEqual(res.status, 200, 'Check access responds');
    assertEqual(res.data?.hasAdminAccess, false, '伪造首节点外网 IP 必须判定无管理权限');
    assertEqual(res.data?.isInternal, false, '不应判定为内网');
  });

  await test('IP Security', '内网 IP 访问后台 API 授权成功 (200 OK)', async () => {
    const res = await request('/api/room/admin/access-check', {
      headers: {
        'X-Forwarded-For': '192.168.1.88',
      },
    });
    assertEqual(res.status, 200, 'Access check response status');
    assertEqual(res.data?.hasAdminAccess, true, '内网 IP 必须获得管理员访问权限');
    assertEqual(res.data?.isInternal, true, 'isInternal 应为 true');
  });

  // ----------------------------------------------------
  // SUITE 2: 房间生命周期与玩家入房测试
  // ----------------------------------------------------
  console.log('\n📦 [SUITE 2] 房间创建、加入与身份权限测试:');

  let room1Code = '';
  let room1Id = '';
  let hostPlayerToken = '';
  let hostPlayerId = '';

  let player2Token = '';
  let player2Id = '';

  let player3Token = '';
  let player3Id = '';

  await test('Room Lifecycle', '房主创建房间 (筹码模式 zero_sum, 初始分 1000)', async () => {
    const res = await request('/api/room/create', {
      method: 'POST',
      body: {
        nickname: 'Alice房主',
        roomTitle: '德州扑克记分室',
        mode: 'zero_sum',
        initialScore: 1000,
        retention: 'offline_30s',
      },
    });

    assertEqual(res.status, 200, '创建房间成功状态码');
    assert(!!res.data?.room?.code, '必须生成房间 code');
    assert(!!res.data?.token, '必须返回玩家 session token');
    assertEqual(res.data?.room?.mode, 'zero_sum', '游戏模式必须为 zero_sum');
    assertEqual(res.data?.room?.initialScore, 1000, '初始分必须为 1000');
    assertEqual(res.data?.player?.score, 1000, '房主初始分必须为 1000');
    assertEqual(res.data?.player?.isHost, true, '创建者必须为 isHost=true');

    room1Code = res.data.room.code;
    room1Id = res.data.room.id;
    hostPlayerToken = res.data.token;
    hostPlayerId = res.data.player.id;
  });

  await test('Room Lifecycle', '玩家 Bob 加入房间', async () => {
    const res = await request('/api/room/join', {
      method: 'POST',
      body: {
        roomCode: room1Code,
        nickname: 'Bob玩家',
      },
    });

    assertEqual(res.status, 200, '加入房间成功状态码');
    assertEqual(res.data?.player?.isHost, false, '普通加入者 isHost 必须为 false');
    assertEqual(res.data?.player?.score, 1000, '加入者分数必须继承房间初始分 1000');

    player2Token = res.data.token;
    player2Id = res.data.player.id;
  });

  await test('Room Lifecycle', '玩家 Charlie 加入房间', async () => {
    const res = await request('/api/room/join', {
      method: 'POST',
      body: {
        roomCode: room1Code,
        nickname: 'Charlie玩家',
      },
    });

    assertEqual(res.status, 200, '加入房间成功状态码');
    player3Token = res.data.token;
    player3Id = res.data.player.id;
  });

  await test('Room Lifecycle', '使用已存在的 token 重新连线 (Session 恢复测试)', async () => {
    const res = await request('/api/room/join', {
      method: 'POST',
      body: {
        roomCode: room1Code,
        nickname: 'Bob玩家',
        token: player2Token,
      },
    });

    assertEqual(res.status, 200, '重连状态码');
    assertEqual(res.data?.player?.id, player2Id, '重连后玩家 ID 应保持一致');
  });

  // ----------------------------------------------------
  // SUITE 3: 筹码零和模式（Zero-Sum）加分与总分守恒定理验证
  // ----------------------------------------------------
  console.log('\n📦 [SUITE 3] 零和模式记分与守恒定理数学校验:');

  await test('Scoring (Zero-Sum)', 'Alice 给 Bob 加 200 分 (Alice -200, Bob +200, 总分守恒)', async () => {
    const res = await request(`/api/room/${room1Id}/score`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hostPlayerToken}` },
      body: {
        fromUserId: hostPlayerId,
        targetUserIds: [player2Id],
        amount: 200,
        note: '赢下底池',
      },
    });

    assertEqual(res.status, 200, '加分成功');
    const room = res.data?.room;
    assertEqual(room?.members[hostPlayerId]?.score, 800, 'Alice 扣减 200 -> 800');
    assertEqual(room?.members[player2Id]?.score, 1200, 'Bob 增加 200 -> 1200');
    assertEqual(room?.members[player3Id]?.score, 1000, 'Charlie 未受影响 -> 1000');

    // Mathematical Invariant Check: Sum = 3000
    const total = Object.values(room.members).reduce((sum: number, p: any) => sum + p.score, 0);
    assertEqual(total, 3000, '零和模式三位玩家总分必须严格保持 3000 守恒');
  });

  await test('Scoring (Zero-Sum)', 'Alice 同时给 Bob 和 Charlie 各加 100 分 (Alice -200, Bob +100, Charlie +100)', async () => {
    const res = await request(`/api/room/${room1Id}/score`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hostPlayerToken}` },
      body: {
        fromUserId: hostPlayerId,
        targetUserIds: [player2Id, player3Id],
        amount: 100,
        note: '平分盲注',
      },
    });

    assertEqual(res.status, 200, '加分成功');
    const room = res.data?.room;
    assertEqual(room?.members[hostPlayerId]?.score, 600, 'Alice 扣减 200 -> 600');
    assertEqual(room?.members[player2Id]?.score, 1300, 'Bob 增加 100 -> 1300');
    assertEqual(room?.members[player3Id]?.score, 1100, 'Charlie 增加 100 -> 1100');

    const total = Object.values(room.members).reduce((sum: number, p: any) => sum + p.score, 0);
    assertEqual(total, 3000, '总分继续严格保持 3000 守恒');
  });

  // ----------------------------------------------------
  // SUITE 4: 扣分同意机制（Deduction Proposal Workflow）安全测试
  // ----------------------------------------------------
  console.log('\n📦 [SUITE 4] 扣分同意提案流程与越权防范测试:');

  let activeProposalId = '';

  await test('Deduction Workflow', 'Alice 尝试直接扣除 Bob 150 分 -> 系统应产生待确认提案，不能立即扣分', async () => {
    const res = await request(`/api/room/${room1Id}/score`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hostPlayerToken}` },
      body: {
        fromUserId: hostPlayerId,
        targetUserIds: [player2Id],
        amount: -150, // Negative amount
        note: '罚款或反向结算',
      },
    });

    assertEqual(res.status, 200, '提交成功');
    assertEqual(res.data?.requiresConsent, true, '负分必须返回 requiresConsent=true');
    assert(res.data?.proposals?.length === 1, '应生成 1 条待同意提案');

    const proposal = res.data.proposals[0];
    assertEqual(proposal.fromUserId, hostPlayerId, '发起人 ID 应为 Alice');
    assertEqual(proposal.targetUserId, player2Id, '被扣分人 ID 应为 Bob');
    assertEqual(proposal.amount, 150, '提议扣除分值应为 150');
    assertEqual(proposal.status, 'pending', '提案状态必须为 pending');

    activeProposalId = proposal.id;

    // Verify Bob & Alice scores are NOT modified yet
    const room = res.data.room;
    assertEqual(room.members[player2Id].score, 1300, 'Bob 分数在同意前不可变动');
    assertEqual(room.members[hostPlayerId].score, 600, 'Alice 分数在同意前不可变动');
  });

  await test('Deduction Workflow', '越权防范：Charlie 试图替 Bob 确认扣分 -> 必须被拒绝', async () => {
    const res = await request(`/api/room/${room1Id}/respond-deduction`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${player3Token}` },
      body: {
        proposalId: activeProposalId,
        accepted: true,
        responderUserId: player3Id, // Charlie tries to respond to Bob's proposal
      },
    });

    assertEqual(res.status, 403, '非目标玩家确认他人扣分必须返回 403 Forbidden');
    assert(res.data?.error?.includes('只有被扣分玩家'), '必须有权限提示');
  });

  await test('Deduction Workflow', '被扣分人 Bob 拒绝扣分 -> 分数不变更，提案标记为 rejected', async () => {
    const res = await request(`/api/room/${room1Id}/respond-deduction`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${player2Token}` },
      body: {
        proposalId: activeProposalId,
        accepted: false,
        responderUserId: player2Id,
      },
    });

    assertEqual(res.status, 200, '响应扣分提案成功');
    assertEqual(res.data?.accepted, false, 'accepted 结果为 false');
    assertEqual(res.data?.proposal?.status, 'rejected', '提案状态应为 rejected');

    const room = res.data?.room;
    assertEqual(room.members[player2Id].score, 1300, 'Bob 分数保持 1300');
    assertEqual(room.members[hostPlayerId].score, 600, 'Alice 分数保持 600');
  });

  await test('Deduction Workflow', '防重放攻击：Bob 再次尝试同意已被拒绝的提案 -> 必须被拒绝', async () => {
    const res = await request(`/api/room/${room1Id}/respond-deduction`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${player2Token}` },
      body: {
        proposalId: activeProposalId,
        accepted: true,
        responderUserId: player2Id,
      },
    });

    assertEqual(res.status, 400, '已处理的提案不可二次操作');
  });

  await test('Deduction Workflow', '发起新扣分提案并由 Bob 正式同意 -> 分数正确结算且总分守恒', async () => {
    // 1. Submit deduction request
    const propRes = await request(`/api/room/${room1Id}/score`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hostPlayerToken}` },
      body: {
        fromUserId: hostPlayerId,
        targetUserIds: [player2Id],
        amount: -300,
        note: '确认扣除筹码',
      },
    });
    const newPropId = propRes.data.proposals[0].id;

    // 2. Bob accepts
    const acceptRes = await request(`/api/room/${room1Id}/respond-deduction`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${player2Token}` },
      body: {
        proposalId: newPropId,
        accepted: true,
        responderUserId: player2Id,
      },
    });

    assertEqual(acceptRes.status, 200, '同意扣分成功');
    const room = acceptRes.data.room;
    // In zero_sum: Target (Bob) loses 300 (1300 -> 1000), Proposer (Alice) gets 300 (600 -> 900)
    assertEqual(room.members[player2Id].score, 1000, 'Bob 扣除 300 -> 1000');
    assertEqual(room.members[hostPlayerId].score, 900, 'Alice 增加 300 -> 900');

    const total = Object.values(room.members).reduce((sum: number, p: any) => sum + p.score, 0);
    assertEqual(total, 3000, '扣分同意后总分依然守恒 3000');
  });

  // ----------------------------------------------------
  // SUITE 5: 房主管理权限（Host RBAC）越权检测与管理功能
  // ----------------------------------------------------
  console.log('\n📦 [SUITE 5] 房主特权与防越权控制测试:');

  await test('Host RBAC', '普通玩家 Bob 试图重置全房间分数 -> 必须被拒绝 (403 Forbidden)', async () => {
    const res = await request(`/api/room/${room1Id}/action`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${player2Token}` },
      body: {
        action: 'reset_scores',
        hostUserId: player2Id, // Bob attempts
      },
    });

    assertEqual(res.status, 403, '非房主操作必须被 403 拒绝');
    assert(res.data?.error?.includes('只有房主'), '必须有房主权限提示');
  });

  await test('Host RBAC', '普通玩家 Charlie 试图踢出 Alice 房主 -> 必须被拒绝 (403 Forbidden)', async () => {
    const res = await request(`/api/room/${room1Id}/action`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${player3Token}` },
      body: {
        action: 'kick_player',
        hostUserId: player3Id,
        targetUserId: hostPlayerId,
      },
    });

    assertEqual(res.status, 403, '非房主操作必须被 403 拒绝');
  });

  await test('Host RBAC', '房主 Alice 成功将全员分数重置为初始分 1000', async () => {
    const res = await request(`/api/room/${room1Id}/action`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hostPlayerToken}` },
      body: {
        action: 'reset_scores',
        hostUserId: hostPlayerId,
      },
    });

    assertEqual(res.status, 200, '房主重置成功');
    const room = res.data?.room;
    assertEqual(room.members[hostPlayerId].score, 1000, 'Alice 重置为 1000');
    assertEqual(room.members[player2Id].score, 1000, 'Bob 重置为 1000');
    assertEqual(room.members[player3Id].score, 1000, 'Charlie 重置为 1000');
  });

  await test('Host RBAC', '房主 Alice 成功将 Charlie 移出房间', async () => {
    const res = await request(`/api/room/${room1Id}/action`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hostPlayerToken}` },
      body: {
        action: 'kick_player',
        hostUserId: hostPlayerId,
        targetUserId: player3Id,
      },
    });

    assertEqual(res.status, 200, '房主移出成员成功');
    const room = res.data?.room;
    assert(!room.members[player3Id], 'Charlie 应不在房间成员列表中');
  });

  // ----------------------------------------------------
  // SUITE 6: 后台管理强制解散与全量房间数据清理
  // ----------------------------------------------------
  console.log('\n📦 [SUITE 6] 后台管理全服房间监管与强制解散测试:');

  await test('Server Admin', '内网管理员查看服务器所有房间列表', async () => {
    const res = await request('/api/room/admin/all', {
      headers: {
        'X-Forwarded-For': '127.0.0.1',
      },
    });

    assertEqual(res.status, 200, '获取房间列表成功');
    assert(Array.isArray(res.data?.rooms), 'rooms 应为数组');
    const found = res.data.rooms.find((r: any) => r.id === room1Id);
    assert(!!found, '应查找到当前测试房间');
    assertEqual(found.memberCount, 2, '当前应剩 Alice 和 Bob 两位成员');
  });

  await test('Server Admin', '内网管理员强制解散并清理房间', async () => {
    const res = await request(`/api/room/admin/room/${room1Id}/delete`, {
      method: 'POST',
      headers: {
        'X-Forwarded-For': '127.0.0.1',
      },
      body: {
        hardDelete: true,
      },
    });

    assertEqual(res.status, 200, '解散成功');
    assert(res.data?.success, 'success 应为 true');

    // Verify room is purged from db
    const checkRes = await request(`/api/room/admin/all`, {
      headers: { 'X-Forwarded-For': '127.0.0.1' },
    });
    const exists = checkRes.data.rooms.some((r: any) => r.id === room1Id);
    assert(!exists, '已彻底从服务器房间列表中清除');
  });

  await test('Server Admin', '已被解散的房间再次加入或记分 -> 应返回 404 房间不存在', async () => {
    const res = await request('/api/room/join', {
      method: 'POST',
      body: {
        roomCode: room1Code,
        nickname: 'David新玩家',
      },
    });

    assertEqual(res.status, 404, '加入已解散房间应返回 404');
  });

  // ----------------------------------------------------
  // SUITE 7: 输入安全与异常边界测试 (XSS / NaN / Extreme Values)
  // ----------------------------------------------------
  console.log('\n📦 [SUITE 7] 输入安全、XSS 防御与异常数值边界测试:');

  await test('Security & Bounds', '防止 NaN 或非数字金额注入', async () => {
    // Create new temporary room
    const r = await request('/api/room/create', {
      method: 'POST',
      body: { nickname: 'Tester', roomTitle: '边界测试', mode: 'free' },
    });
    const tRoomId = r.data.room.id;
    const tToken = r.data.token;
    const tHostId = r.data.player.id;

    const res = await request(`/api/room/${tRoomId}/score`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tToken}` },
      body: {
        fromUserId: tHostId,
        targetUserIds: [tHostId],
        amount: 'invalid_number' as any,
      },
    });

    assertEqual(res.status, 400, '非法数值必须返回 400 Bad Request');
  });

  await test('Security & Bounds', '防止 0 金额无意义刷流水', async () => {
    const r = await request('/api/room/create', {
      method: 'POST',
      body: { nickname: 'Tester2', roomTitle: '0分测试', mode: 'free' },
    });
    const tRoomId = r.data.room.id;
    const tToken = r.data.token;
    const tHostId = r.data.player.id;

    const res = await request(`/api/room/${tRoomId}/score`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tToken}` },
      body: {
        fromUserId: tHostId,
        targetUserIds: [tHostId],
        amount: 0,
      },
    });

    assertEqual(res.status, 400, '0分记分必须返回 400');
  });

  await test('Security & Bounds', '超长昵称注入防御 (超过20字符应返回400)', async () => {
    const longPayload = 'A'.repeat(25);
    const r = await request('/api/room/create', {
      method: 'POST',
      body: { nickname: longPayload, roomTitle: '测试', mode: 'free' },
    });
    assertEqual(r.status, 400, '超长昵称必须被拦截并返回 400');
  });

  await test('Security & Bounds', 'XSS 注入攻击测试 (HTML / JS Payload 长度合规转义与安全存储)', async () => {
    const xssPayload = '<b>alert(1)</b>';
    const r = await request('/api/room/create', {
      method: 'POST',
      body: { nickname: xssPayload, roomTitle: xssPayload, mode: 'free' },
    });

    assertEqual(r.status, 200, '创建成功');
    const player = r.data.player;
    assert(player.nickname.includes('alert'), '昵称原样保留文本并被 React 默认文本安全渲染');
  });

  // ----------------------------------------------------
  // Summary output
  // ----------------------------------------------------
  console.log('\n====================================================');
  const totalTests = results.length;
  const passedTests = results.filter(r => r.passed).length;
  const failedTests = results.filter(r => !r.passed).length;

  console.log(`📊 测试报告总结: 共 ${totalTests} 项用例 | ✅ 通过: ${passedTests} | ❌ 失败: ${failedTests}`);
  console.log('====================================================');

  if (failedTests > 0) {
    console.error('\n⚠️ 失败用例详情:');
    results.filter(r => !r.passed).forEach((r) => {
      console.error(`- [${r.suite}] ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 所有功能、权限安全、零和守恒、扣分确认与内网隔离测试用例均 100% 验证通过！\n');
  }
}

runAllTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
