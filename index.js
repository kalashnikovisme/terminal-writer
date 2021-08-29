const bashPrompt = '\x1B[36m~:\x1B[0m '
let term = new Terminal({ cols: 120, rows: 80, fontSize: '20' });
const typingTimeout = 100
const directives = ['input:', 'output:', 'audio:', 'delay:']

const typing = (command, typingTimeout) => {
  _.each(command, (ch, i) => {
    setTimeout(() => {
      term.write(ch)
    }, typingTimeout * i)
  })
}

const runPart = (data, index) => {
  const part = data[index]
  let timeoutBeforeTheNext;
  if (part) {
    switch(part.type) {
      case 'typing': {
        typing(part.data, typingTimeout)
        timeoutBeforeTheNext = part.data.length * typingTimeout
        break
      }
      case 'delay': {
        timeoutBeforeTheNext = part.data
      }
    }
  }
  setTimeout(() => {
    runPart(data, index + 1)
  }, timeoutBeforeTheNext)
}

const runInput = (data, actions, index) => {
  let overallTimeout = 0
  _.each(data, (part) => {
    switch(part.type) {
      case 'typing': {
        overallTimeout += (part.data.length + 1) * typingTimeout
        break
      }
      case 'delay': {
        overallTimeout += part.data
        break
      }
    }
  })

  setTimeout(() => {
    term.write('\n\r');
    if (actions[index + 1] && ['input', 'delay'].includes(actions[index + 1].action)) {
      term.write(bashPrompt)
    }
    runAction(actions, index + 1)
  }, overallTimeout)

  runPart(data, 0)
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

const delay = (milliseconds, actions, index) => {
  setTimeout(() => {
    runAction(actions, index + 1)
  }, milliseconds)
}

const runAction = (actions, index) => {
  const action = actions[index]
  if (action) {
    switch(action.action) {
      case 'input': {
        runInput(action.data, actions, index)
        break
      }
      case 'output': {
        showOutput(action.data, actions, index)
        break
      }
      case 'delay': {
        delay(action.data, actions, index)
      }
    }
  }
}

const runScenario = (actions) => {
  runAction(actions, 0)
}

const parseInput = (line) => {
  const action = {
    action: 'input', 
  }
  let data
  const delayRegex = /\%\{delay \d+\}/g;
  if (line.match(delayRegex)) {
    const millisecondsRegex = /\d+/
    const mil = parseInt(line.match(delayRegex)[0].match(millisecondsRegex)[0])
    data = [
      { type: 'typing', data: line.split(delayRegex)[0] },
      { type: 'delay', data: mil },
      { type: 'typing', data: line.split(delayRegex)[1] },
    ]
  } else {
    data = [{ type: 'typing', data: line }]
  }
  return { ...action, data }
}

const readSingleFile = (e) => {
  var file = e.target.files[0];
  if (!file) {
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    var contents = e.target.result;
    var lines = contents.split("\n")
    let actions = []
    for (var i = 0; i < lines.length; i++) {
      if (lines[i] == 'input:') {
        actions.push(parseInput(lines[i + 1]))
        i++
      }
      if (lines[i] == 'output:') {
        var output = []
        for (var j = i + 1; j < lines.length; j++) {
          if (!directives.includes(lines[j])) {
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
      if (lines[i] == 'delay:') {
        actions.push({ action: 'delay', data: parseInt(lines[i + 1]) })
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
