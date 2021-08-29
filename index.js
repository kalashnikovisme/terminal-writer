const bashPrompt = '\x1B[36m~:\x1B[0m '
let term = new Terminal({ cols: 120, rows: 47, fontSize: '30' });
const typingTimeout = 100
const directives = ['input:', 'output:', 'audio:', 'delay:']
const newLine = '\n\r'
const delayRegex = /\%\{delay \d+\}/g;

const typing = (command, typingTimeout) => {
  _.each(command, (ch, i) => {
    setTimeout(() => {
      term.write(ch)
    }, typingTimeout * i)
  })
}

const runInputPart = (data, index) => {
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
    runInputPart(data, index + 1)
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

  runInputPart(data, 0)
}

const showPart = (output, index) => {
  const part = output[index]
  let timeoutBeforeTheNext = 0;
  if (part) {
    switch(part.type) {
      case 'text': {
        const nextPart = output[index + 1] 
        if (index == output.length - 1) {
          term.write(part.data + bashPrompt)
        } else {
          if (nextPart && ['colorBegin', 'colorEnd', 'delay'].includes(nextPart.type)) {
            term.write(part.data)
          } else {
            term.write(part.data + newLine)
          }
        }
        break
      }
      case 'colorBegin': {
        term.write(`\x1B[1;${part.data}`)
        break
      }
      case 'colorEnd': {
        term.write('\x1B[0m')
        break
      }
      case 'delay': {
        timeoutBeforeTheNext = part.data
        break
      }
    }
  }
  setTimeout(() => {
    showPart(output, index + 1)
  }, timeoutBeforeTheNext)
}

const showOutput = (output, actions, index) => {
  setTimeout(() => {
    showPart(output, 0)
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

const parseOutput = (lines, index) => {
  const action = {
    action: 'output'
  }
  var data = []
  for (var j = index + 1; j < lines.length; j++) {
    const line = lines[j]
    if (!directives.includes(line)) {
      const colorRegex = /\%\{begin:\d+m}.*\%\{end:\d+m\}/
      if (line.match(colorRegex)) {
        const colorCodeRegex = /\d+m/
        const color = line.match(colorRegex)[0].match(colorCodeRegex)[0]
        const beginRegex = /\%\{begin:\d+m}/
        const endRegex = /\%\{end:\d+m}/
        data.push({ type: 'text', data: line.split(beginRegex)[0] })
        data.push({ type: 'colorBegin', data: color })
        data.push({ type: 'text', data: line.split(beginRegex)[1].split(endRegex)[0] })
        data.push({ type: 'colorEnd', data: color })
        data.push({ type: 'text', data: line.split(endRegex)[1] })
      } else if (line.match(delayRegex)) {
        const millisecondsRegex = /\d+/
        const mil = parseInt(line.match(delayRegex)[0].match(millisecondsRegex)[0])
        data.push({ type: 'text', data: line.split(delayRegex)[0] })
        data.push({ type: 'delay', data: mil })
        data.push({ type: 'text', data: line.split(delayRegex)[1] })
      } else {
        data.push({ type: 'text', data: line })
      }
    } else {
      break
    }
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
        actions.push(parseOutput(lines, i))
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
