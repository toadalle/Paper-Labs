export function renderBenchmarkPage(): { objects: string; workspace: string; inspector: string } {
  return {
    objects: '<div class="panel-heading"><div><div class="eyebrow">Objects</div><h2>Benchmark</h2></div></div><div class="objects-summary"><span>0 runs</span></div>',
    workspace: '<div class="workspace-header"><div><div class="eyebrow">Search validation</div><h1>Benchmark</h1></div></div><div class="empty-state"><strong>No Search Benchmark runs yet.</strong><span>The benchmark will compare proposer strategies under a frozen evaluation budget across Discovery, Validation, and Final Holdout.</span></div>',
    inspector: '<div class="inspector-section profile"><div class="eyebrow">Inspector</div><h2>Benchmark</h2><div class="placeholder">Final Holdout remains reserved for Search Benchmark completion, not routine Promotion.</div></div>'
  };
}
