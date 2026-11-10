<script> import Icon from '../components/Icon.svelte'; </script>
<header class="pg"><p class="data">Menu</p><h1>Mais</h1></header>
<ul class="grupo card">
  <li><a href="#/simulados"><span class="t"><strong>Simulados</strong><span class="sub">Notas por matéria e gráfico de evolução</span></span><span class="go"><Icon nome="ext" size={18} /></span></a></li>
  <li><a href="#/ajustes"><span class="t"><strong>Ajustes</strong><span class="sub">Datas, horários, metas, tema, backup e Google Agenda</span></span><span class="go"><Icon nome="ext" size={18} /></span></a></li>
</ul>
<style>
  a { display: flex; align-items: center; gap: 12px; padding: 16px; min-height: 72px; text-decoration: none; color: inherit; }
  .t { flex: 1; display: grid; gap: 2px; } .go { color: var(--ac); }
</style>
