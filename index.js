const bashPrompt = '\x1B[36m~:\x1B[0m '
var term = new Terminal({ cols: 120, rows: 80, fontSize: '20' });

const runInput = (command, actions, index) => {
  const typingTimeout = 100
  const overallTimeout = (command.length + 1) * typingTimeout

  setTimeout(() => {
    runAction(actions, index + 1)
  }, overallTimeout)

  _.each(command, (ch, i) => {
    setTimeout(() => {
      term.write(ch)
    }, typingTimeout * i)
  })
  setTimeout(() => {
    term.write('\n\r');
  }, typingTimeout * command.length)
}

const showOutput = (output, actions, index) => {
  setTimeout(() => {
    _.each(output, (line, index) => {
      if (index == output.length - 1) {
        term.write(line)
      } else {
        term.write(line + '\n\r')
      }
    })
    term.write(bashPrompt)
  }, 100)
  runAction(actions, index + 1)
}

const runAction = (actions, index) => {
  const action = actions[index]
  if (action) {
    switch(action.action) {
      case 'input':
        runInput(action.data, actions, index)
      break
      case 'output':
        showOutput(action.data, actions, index)
      break
    }
  }
}

const runScenario = (actions) => {
  runAction(actions, 0)
}

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
    let actions = []
    for (var i = 0; i < lines.length; i++) {
      if (lines[i] == 'input:') {
        actions.push({ action: 'input', data: lines[i + 1] })
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
        actions.push({ action: 'output', data: output })
      }
      if (lines[i] == 'audio:') {
        const audio = document.createElement('audio')
        audio.autoplay = true
        const source = document.createElement('source')
        source.src = `./scenarios/${lines[i + 1]}`
        audio.appendChild(source)
        const body = document.getElementById('body')
        body.appendChild(audio)
      }
    }
    console.log(actions)

    runScenario(actions) 
  };
  reader.readAsText(file);
}

const pressEnter = () => {
  term.write('\n');
  setTimeout(() => {
    term.write(bashPrompt)
  }, 50)
}

window.addEventListener('load', () => {
  term.open(document.getElementById('terminal'));
  term.write(bashPrompt)
  term.onKey((key, ev) => {
    if (key.domEvent.key == 'Enter') {
      pressEnter()
    }
    if (key.domEvent.key == 'Backspace') {
      term.write('\b');
    }
    term.write(key.key);
  });

  document.getElementById('file-input').addEventListener('change', readSingleFile, false);
})
