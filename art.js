// 상단 배너에 띄우는 상태 그림 (인라인 SVG)
window.GGB_ART = (() => {
  const star = (x, y, s, fill) => {
    const k = s * 0.28;
    return `<path class="twinkle" fill="${fill}" d="M${x} ${y - s}L${x + k} ${y - k}L${x + s} ${y}L${x + k} ${y + k}L${x} ${y + s}L${x - k} ${y + k}L${x - s} ${y}L${x - k} ${y - k}Z"/>`;
  };
  const fly = (x, y) => `
    <g transform="translate(${x} ${y})">
      <ellipse cx="-2.5" cy="-3" rx="3.2" ry="2" fill="#d0d7de" opacity=".9"/>
      <ellipse cx="2.5" cy="-3" rx="3.2" ry="2" fill="#d0d7de" opacity=".9"/>
      <circle r="2.6" fill="#222"/>
    </g>`;

  // 지출 > 수입: 깡통 든 거지
  const beggar = `
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="비 맞으며 깡통을 든 거지">
  <g fill="#8a9099">
    <circle cx="40" cy="30" r="13"/><circle cx="58" cy="24" r="16"/><circle cx="76" cy="31" r="12"/>
    <rect x="27" y="30" width="62" height="13" rx="6.5"/>
  </g>
  <path class="rain" d="M38 50l-4 9M54 50l-4 9M70 50l-4 9M46 64l-4 9M62 64l-4 9" stroke="#74a9e0" stroke-width="2.5" stroke-linecap="round"/>
  <ellipse cx="100" cy="186" rx="88" ry="7" fill="#000" opacity=".12"/>
  <g transform="rotate(-7 162 158)">
    <rect x="136" y="138" width="54" height="40" rx="2" fill="#c9a27a" stroke="#8b6a45" stroke-width="2"/>
    <text x="163" y="155" text-anchor="middle" font-size="11" font-weight="700" fill="#5a4026">도와</text>
    <text x="163" y="170" text-anchor="middle" font-size="11" font-weight="700" fill="#5a4026">주세요</text>
  </g>
  <ellipse cx="96" cy="174" rx="46" ry="11" fill="#5b5f6b"/>
  <rect x="104" y="168" width="12" height="8" fill="#7d8290" transform="rotate(8 110 172)"/>
  <path d="M70 102Q96 94 122 102L132 166L124 160L116 169L108 160L100 169L92 160L84 169L76 160L60 166Z" fill="#8b6b4a" stroke="#5e4630" stroke-width="2" stroke-linejoin="round"/>
  <rect x="104" y="118" width="14" height="12" fill="#b0925f" stroke="#5e4630" stroke-width="1.2" stroke-dasharray="2 2" transform="rotate(12 111 124)"/>
  <rect x="80" y="138" width="12" height="11" fill="#6f7b5a" stroke="#5e4630" stroke-width="1.2" stroke-dasharray="2 2" transform="rotate(-8 86 143)"/>
  <path d="M78 114L56 150" stroke="#7a5c3f" stroke-width="11" stroke-linecap="round"/>
  <rect x="38" y="152" width="24" height="26" rx="2" fill="#a3acb6" stroke="#6c757d" stroke-width="2"/>
  <path d="M40 162h20M40 170h20" stroke="#8a939d" stroke-width="1.5"/>
  <ellipse cx="50" cy="152" rx="12" ry="4" fill="#6c757d"/>
  <ellipse cx="50" cy="151.5" rx="4" ry="1.6" fill="#f2c94c"/>
  <circle cx="56" cy="151" r="6" fill="#e2b183"/>
  <circle cx="96" cy="74" r="25" fill="#e2b183"/>
  <path d="M71 72L72 55L78 61L82 48L89 57L96 45L101 56L109 47L113 58L120 52L121 72Q114 59 96 59Q78 59 71 72Z" fill="#4a4540"/>
  <ellipse cx="81" cy="85" rx="5" ry="3" fill="#8b6b4a" opacity=".35"/>
  <path d="M81 68L90 64M102 64L111 68" stroke="#3b302a" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="87" cy="74" r="2.6" fill="#2b2b2b"/><circle cx="105" cy="74" r="2.6" fill="#2b2b2b"/>
  <path d="M83 79q4 2 8 0M101 79q4 2 8 0" stroke="#a07050" stroke-width="1.2" fill="none"/>
  <path d="M107 81q-3 6 0 9q3-3 0-9Z" fill="#6fb7ff"/>
  <path d="M88 93Q96 86 104 93" stroke="#6b3b2b" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <g fill="#6d5a4a" opacity=".55">
    <circle cx="84" cy="90" r="1"/><circle cx="86" cy="95" r="1"/><circle cx="91" cy="98" r="1"/><circle cx="96" cy="99" r="1"/>
    <circle cx="101" cy="98" r="1"/><circle cx="106" cy="95" r="1"/><circle cx="108" cy="90" r="1"/>
  </g>
  <g class="flies">${fly(132, 52)}${fly(62, 60)}</g>
</svg>`;

  // 적자는 아니지만 저금 목표 미달: 적자 구덩이 위 외줄타기
  const struggle = `
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="적자 구덩이 위에서 외줄을 타는 사람">
  <ellipse cx="100" cy="182" rx="72" ry="13" fill="#2b2b2b" opacity=".85"/>
  <text x="100" y="187" text-anchor="middle" font-size="12" font-weight="800" fill="#ff6b6b">적자</text>
  <rect x="8" y="118" width="8" height="72" fill="#8b6a45"/>
  <rect x="184" y="118" width="8" height="72" fill="#8b6a45"/>
  <path d="M12 122Q100 162 188 122" stroke="#8b6a45" stroke-width="3" fill="none"/>
  <g class="wobble">
    <path d="M95 118L93 141M105 118L108 141" stroke="#3d4a5c" stroke-width="6" stroke-linecap="round"/>
    <rect x="85" y="88" width="30" height="34" rx="7" fill="#5c7cfa"/>
    <path d="M88 96L68 104M112 96L132 100" stroke="#5c7cfa" stroke-width="7" stroke-linecap="round"/>
    <path d="M38 108L162 96" stroke="#6b4f2f" stroke-width="4" stroke-linecap="round"/>
    <circle cx="100" cy="66" r="22" fill="#f1c9a5"/>
    <path d="M78 62Q80 42 100 42Q120 42 122 62Q112 52 100 54Q88 52 78 62Z" fill="#3b3b3b"/>
    <path d="M88 61L96 57M104 57L112 61" stroke="#3b302a" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="93" cy="66" r="2.5" fill="#2b2b2b"/><circle cx="107" cy="66" r="2.5" fill="#2b2b2b"/>
    <path d="M91 78q3-3 6 0t6 0t6 0" stroke="#6b3b2b" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M125 50q-4 7 0 10q4-3 0-10Z" fill="#74c0fc"/>
    <path d="M75 56q-3 5 0 7q3-2 0-7Z" fill="#74c0fc"/>
  </g>
</svg>`;

  // 수입 > 지출 (목표 달성): 부자 공주
  const princess = `
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="왕관을 쓰고 돈주머니를 든 부자 공주">
  ${star(28, 40, 9, '#ffd43b')}${star(170, 34, 6, '#ffd43b')}${star(168, 124, 5, '#f783ac')}${star(32, 116, 6, '#f783ac')}${star(150, 70, 4, '#ffe066')}
  <g fill="#f2c14e" stroke="#c99700" stroke-width="1.5">
    <ellipse cx="34" cy="184" rx="13" ry="4.5"/><ellipse cx="36" cy="178" rx="13" ry="4.5"/><ellipse cx="33" cy="172" rx="13" ry="4.5"/>
    <ellipse cx="166" cy="184" rx="13" ry="4.5"/><ellipse cx="163" cy="178" rx="13" ry="4.5"/>
  </g>
  <path d="M74 72Q70 118 80 128L120 128Q130 118 126 72Q100 44 74 72Z" fill="#f2c14e"/>
  <path d="M86 104L114 104L118 126Q138 156 150 182L50 182Q62 156 82 126Z" fill="#f78fb3" stroke="#d6588a" stroke-width="2" stroke-linejoin="round"/>
  <path d="M50 182q8-8 17 0t17 0t17 0t16 0t17 0t16 0" fill="none" stroke="#fcc2d7" stroke-width="4"/>
  <rect x="83" y="122" width="34" height="6" rx="3" fill="#d6588a"/>
  <rect x="96" y="94" width="8" height="12" fill="#f6d0b1"/>
  <path d="M88 108L66 94" stroke="#f6d0b1" stroke-width="7" stroke-linecap="round"/>
  <path d="M57 74h16l-3 5q14 8 10 22q-2 6-15 6q-13 0-15-6q-4-14 10-22Z" fill="#e0b030" stroke="#b38600" stroke-width="1.5"/>
  <text x="65" y="101" text-anchor="middle" font-size="13" font-weight="800" fill="#7a5b00">₩</text>
  <path d="M112 108L134 98" stroke="#f6d0b1" stroke-width="7" stroke-linecap="round"/>
  <path d="M134 98L146 66" stroke="#e0a800" stroke-width="3" stroke-linecap="round"/>
  ${star(147, 60, 8, '#ffd43b')}
  <circle cx="100" cy="74" r="24" fill="#f6d0b1"/>
  <path d="M76 74Q78 50 100 50Q122 50 124 74Q114 60 100 62Q86 60 76 74Z" fill="#f2c14e"/>
  <path d="M84 54L85 36L93 45L100 30L107 45L115 36L116 54Z" fill="#ffd43b" stroke="#e0a800" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="100" cy="45" r="3" fill="#e64980"/><circle cx="89" cy="49" r="2" fill="#4dabf7"/><circle cx="111" cy="49" r="2" fill="#4dabf7"/>
  <path d="M87 75q4-5 8 0M105 75q4-5 8 0" stroke="#3b2b2b" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <ellipse cx="85" cy="83" rx="5" ry="3" fill="#ff8fab" opacity=".55"/>
  <ellipse cx="115" cy="83" rx="5" ry="3" fill="#ff8fab" opacity=".55"/>
  <path d="M92 86Q100 96 108 86Z" fill="#c2255c"/>
</svg>`;

  // 기록 없음: 돼지 저금통
  const empty = `
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="동전이 떨어지는 돼지 저금통">
  <ellipse cx="100" cy="184" rx="62" ry="6" fill="#000" opacity=".1"/>
  <g fill="#f48fb1">
    <rect x="64" y="152" width="13" height="28" rx="4"/><rect x="84" y="156" width="13" height="26" rx="4"/>
    <rect x="110" y="156" width="13" height="26" rx="4"/><rect x="128" y="152" width="13" height="28" rx="4"/>
  </g>
  <path d="M46 124q-14-4-9-13q7-2 4 6" stroke="#f48fb1" stroke-width="3" fill="none" stroke-linecap="round"/>
  <ellipse cx="100" cy="130" rx="56" ry="40" fill="#f8a5c2"/>
  <path d="M76 98L82 76L96 93Z" fill="#f48fb1"/>
  <ellipse cx="154" cy="132" rx="10" ry="13" fill="#f48fb1"/>
  <circle cx="151" cy="128" r="2" fill="#c2255c"/><circle cx="151" cy="137" r="2" fill="#c2255c"/>
  <circle cx="132" cy="116" r="3.5" fill="#3b2b2b"/>
  <rect x="88" y="92" width="24" height="4" rx="2" fill="#c2255c"/>
  <g class="drop">
    <circle cx="100" cy="62" r="11" fill="#ffd43b" stroke="#e0a800" stroke-width="2"/>
    <text x="100" y="67" text-anchor="middle" font-size="12" font-weight="800" fill="#a07800">₩</text>
  </g>
</svg>`;

  return { beggar, struggle, princess, empty };
})();
