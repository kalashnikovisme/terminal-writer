let actions = []

const readSingleFile = (e) => {
  var file = e.target.files[0];
  if (!file) {
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    var contents = e.target.result;
    console.log(contents);
    var lines = contents.split("\n")
    for (var i = 0; i < lines.length; i++) {
      if (lines[i] == 'input:') {
        actions.push({ input: lines[i + 1] })
        i++
      }
      if (lines[i] == 'output:') {
        var output = []
        for (var j = i + 1; j < lines.length; j++) {
          if (lines[j] != 'input:' && lines[j] != 'output:') {
            output.push(lines[j])
          } else {
            break
          }
        }
        actions.push({ output })
      }
    }
    console.log(actions)
  };
  reader.readAsText(file);
}

window.addEventListener('load', () => {
  var term = new Terminal();
  term.open(document.getElementById('terminal'));
  term.write('~:')
  term.onKey((key, ev) => {
    if (key.domEvent.key == 'Enter') {
      term.write('\n');
      setTimeout(() => {
        term.write('~:')
      }, 50)
    }
    term.write(key.key);
  });

  document.getElementById('file-input').addEventListener('change', readSingleFile, false);
})
