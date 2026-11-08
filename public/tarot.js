// 78-card tarot deck with short upright / reversed keywords (own wording).
(function (root) {
  const MAJOR = [
    ['The Fool', 'new beginnings, a leap of faith', 'recklessness, fear of starting'],
    ['The Magician', 'willpower, using what you have', 'scattered energy, self-doubt'],
    ['The High Priestess', 'intuition, inner knowing', 'ignoring your gut, secrets'],
    ['The Empress', 'abundance, care, creativity', 'neglecting yourself, dependence'],
    ['The Emperor', 'structure, authority, stability', 'rigidity, control issues'],
    ['The Hierophant', 'tradition, guidance, shared values', 'breaking convention, rebellion'],
    ['The Lovers', 'a values-based choice, union', 'misalignment, avoiding a choice'],
    ['The Chariot', 'determination, moving forward', 'lack of direction, being pulled two ways'],
    ['Strength', 'quiet courage, patience', 'self-doubt, low energy'],
    ['The Hermit', 'reflection, looking inward', 'isolation, avoiding others'],
    ['Wheel of Fortune', 'cycles, a turning point', 'resisting change, bad timing'],
    ['Justice', 'fairness, clear consequences', 'avoiding accountability, imbalance'],
    ['The Hanged Man', 'pause, a new perspective', 'stalling, indecision'],
    ['Death', 'an ending that makes room for change', 'clinging to what is over'],
    ['Temperance', 'balance, moderation, patience', 'excess, impatience'],
    ['The Devil', 'attachments, habits that bind', 'breaking free, release'],
    ['The Tower', 'sudden change, a truth revealed', 'avoiding upheaval, delayed change'],
    ['The Star', 'hope, renewal, healing', 'discouragement, lost faith'],
    ['The Moon', 'uncertainty, dreams, unclear paths', 'clarity returning, fears fading'],
    ['The Sun', 'joy, success, vitality', 'temporary clouds, low confidence'],
    ['Judgement', 'a wake-up call, an honest reckoning', 'self-criticism, ignoring the call'],
    ['The World', 'completion, wholeness, arrival', 'loose ends, unfinished business'],
  ];
  const SUITS = {
    Wands: 'energy and ambition', Cups: 'feelings and relationships', Swords: 'thoughts and conflict', Pentacles: 'money, work and the body'
  };
  const RANKS = [
    ['Ace', 'a fresh start in', 'a blocked start in'],
    ['Two', 'a choice or partnership in', 'imbalance in'],
    ['Three', 'early growth and teamwork in', 'delays in'],
    ['Four', 'stability and rest in', 'stagnation in'],
    ['Five', 'struggle or loss in', 'recovery in'],
    ['Six', 'harmony and support in', 'lingering in the past with'],
    ['Seven', 'testing and strategy in', 'giving up on'],
    ['Eight', 'movement and effort in', 'feeling stuck in'],
    ['Nine', 'near-completion in', 'anxiety about'],
    ['Ten', 'a cycle completing in', 'burden or overload in'],
    ['Page', 'curiosity and learning in', 'immaturity in'],
    ['Knight', 'bold action in', 'haste in'],
    ['Queen', 'mature care and mastery of', 'insecurity around'],
    ['King', 'leadership and command of', 'misuse of power in'],
  ];
  const deck = MAJOR.map(([name, up, rev]) => ({ name, arcana: 'major', upright: up, reversed_kw: rev }));
  for (const [suit, theme] of Object.entries(SUITS))
    for (const [rank, up, rev] of RANKS)
      deck.push({ name: `${rank} of ${suit}`, arcana: 'minor', suit, upright: `${up} ${theme}`, reversed_kw: `${rev} ${theme}` });

  function draw(n, positions) {
    const pool = deck.slice(), out = [];
    const rnd = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
    for (let i = 0; i < n; i++) {
      const c = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
      out.push({ ...c, reversed: rnd() < 0.3, position: positions[i] });
    }
    return out;
  }
  root.Tarot = { deck, draw };
})(typeof window !== 'undefined' ? window : globalThis);
