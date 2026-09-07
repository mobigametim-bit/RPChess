const MARKER='data-post-pages-ui-review7';

function ensureStyle(){
  if(document.querySelector(`[${MARKER}]`))return;
  const style=document.createElement('style');
  style.setAttribute(MARKER,'');
  style.textContent=`
/* Live-device visual follow-up: desktop Settlement service emblems + board role glyphs. */
@media (orientation:landscape) and (min-width:1181px) {
  html[data-landscape-ui='1'] body.settlement-active #app main.settlement-screen .settlement-service__icon {
    background-color:transparent!important;
    border:0!important;
    border-radius:0!important;
    box-shadow:none!important;
  }
}

/* Battle / Skirmish / Training board role glyphs: twice the accepted size, bottom-centred,
   filled on both sides and outlined with the opposing colour for readability. */
html body .classic-piece-marker,
html body .puzzle-piece-marker {
  top:auto!important;
  left:50%!important;
  right:auto!important;
  bottom:clamp(1px,.25vw,4px)!important;
  width:auto!important;
  height:auto!important;
  margin:0!important;
  padding:0!important;
  transform:translateX(-50%)!important;
  font-size:0!important;
  line-height:1!important;
  overflow:visible!important;
}
html body .classic-piece-marker::before,
html body .puzzle-piece-marker::before {
  display:block;
  font-family:'Segoe UI Symbol','Noto Sans Symbols 2',serif;
  font-size:clamp(39px,3.15vw,51px)!important;
  font-weight:400;
  line-height:.88;
  text-align:center;
  paint-order:stroke fill;
}
html body .classic-piece-marker[data-piece-marker='p']::before,
html body .puzzle-piece-marker[data-puzzle-piece-marker='p']::before {content:'♟'}
html body .classic-piece-marker[data-piece-marker='n']::before,
html body .puzzle-piece-marker[data-puzzle-piece-marker='n']::before {content:'♞'}
html body .classic-piece-marker[data-piece-marker='b']::before,
html body .puzzle-piece-marker[data-puzzle-piece-marker='b']::before {content:'♝'}
html body .classic-piece-marker[data-piece-marker='r']::before,
html body .puzzle-piece-marker[data-puzzle-piece-marker='r']::before {content:'♜'}
html body .classic-piece-marker[data-piece-marker='q']::before,
html body .puzzle-piece-marker[data-puzzle-piece-marker='q']::before {content:'♛'}
html body .classic-piece-marker[data-piece-marker='k']::before,
html body .puzzle-piece-marker[data-puzzle-piece-marker='k']::before {content:'♚'}

html body .classic-piece-marker--w::before,
html body .puzzle-piece-marker--w::before {
  color:#fff!important;
  -webkit-text-stroke:clamp(1.5px,.14vw,2.25px) #050505;
  text-shadow:-1px -1px 0 #050505,1px -1px 0 #050505,-1px 1px 0 #050505,1px 1px 0 #050505,0 2px 3px rgba(0,0,0,.75)!important;
}
html body .classic-piece-marker--b::before,
html body .puzzle-piece-marker--b::before {
  color:#050505!important;
  -webkit-text-stroke:clamp(1.5px,.14vw,2.25px) #fff;
  text-shadow:-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff,1px 1px 0 #fff,0 2px 3px rgba(0,0,0,.55)!important;
}

@media (orientation:landscape) and (max-width:980px) and (max-height:520px) {
  html body .classic-piece-marker,
  html body .puzzle-piece-marker {bottom:0!important}
  html body .classic-piece-marker::before,
  html body .puzzle-piece-marker::before {font-size:39px!important}
}
`;
  document.head.append(style);
}

setTimeout(ensureStyle,0);

export { ensureStyle };