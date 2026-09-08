
function makeSortable(tableId) {
  var table = document.getElementById(tableId);
  if (!table) return;
  var ths = table.querySelectorAll('th.sortable');
  ths.forEach(function(th, colIdx) {
    th.addEventListener('click', function() {
      var tbody = table.querySelector('tbody');
      var rows = Array.from(tbody.querySelectorAll('tr'));
      var isAsc = th.classList.contains('asc');
      ths.forEach(function(t) { t.classList.remove('asc'); t.classList.remove('desc'); });
      th.classList.add(isAsc ? 'desc' : 'asc');
      var dir = isAsc ? -1 : 1;
      rows.sort(function(a, b) {
        var va = a.cells[colIdx].textContent.trim().replace(/[^0-9.\-]/g, '');
        var vb = b.cells[colIdx].textContent.trim().replace(/[^0-9.\-]/g, '');
        var na = parseFloat(va), nb = parseFloat(vb);
        if (!isNaN(na) && !isNaN(nb)) return (na - nb) * dir;
        return a.cells[colIdx].textContent.trim().localeCompare(b.cells[colIdx].textContent.trim()) * dir;
      });
      rows.forEach(function(r) { tbody.appendChild(r); });
    });
  });
}

makeSortable('g1-table');
makeSortable('g2-table');
makeSortable('g3-table');
