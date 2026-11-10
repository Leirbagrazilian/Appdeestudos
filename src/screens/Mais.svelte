<script> import Icon from '../components/Icon.svelte'; </script>
<header class="pg"><p class="data">Menu</p><h1>Mais</h1></header>
<ul class="grupo card">
  <li><a href="#/simulados"><span class="t"><strong>Simulados</strong><span class="sub">Notas por matéria e gráfico de evolução</span></span><span class="go"><Icon nome="ext" size={18} /></span></a></li>
  <li><a href="#/lacunas"><span class="t"><strong>Mapa de lacunas</strong><span class="sub">Nota de 0 a 3 por tópico e as prioridades do momento</span></span><span class="go"><Icon nome="mapa" size={18} /></span></a></li>
  <li><a href="#/conquistas"><span class="t"><strong>Insígnias e capítulos</strong><span class="sub">Suas conquistas e as fases concluídas</span></span><span class="go"><Icon nome="trofeu" size={18} /></span></a></li>
  <li><a href="#/questoes"><span class="t"><strong>Onde achar questões</strong><span class="sub">Provas e gabaritos: Escola Naval, EFOMM, ITA e ENEM</span></span><span class="go"><Icon nome="ext" size={18} /></span></a></li>
  <li><a href="#/ajustes"><span class="t"><strong>Ajustes</strong><span class="sub">Animações, texto, vibração, sons, carta, datas, metas e backup</span></span><span class="go"><Icon nome="ext" size={18} /></span></a></li>
</ul>
<style>
  a { display: flex; align-items: center; gap: 12px; padding: 16px; min-height: 72px; text-decoration: none; color: inherit; }
  .t { flex: 1; display: grid; gap: 2px; } .go { color: var(--ac); }
</style>
