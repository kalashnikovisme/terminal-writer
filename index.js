let bashPrompt = '~:'
let term = new Terminal({ cols: 120, rows: 26, fontSize: '30' });
const baseTypingTimeout = 100
let typingSpeed = 1
const directives = [
  'input',
  'output',
  'audio',
  'delay',
  'clear',
  'paste',
  'prompt',
  'cursor',
  'scroll_lines',
  'margin-x',
  'margin-y',
  'typing_speed',
]
const newLine = '\n\r'
const delayRegex = /\%\{delay \d+\}/g;
const directivePattern = /^([a-z_-]+):(?:\s*(.*))?$/
let marginX = 0
let marginY = 0
let cursorVisible = true

const getTypingTimeout = () => baseTypingTimeout / typingSpeed

const parseDirectiveLine = (line) => {
  const match = line.match(directivePattern)
  if (!match) {
    return null
  }
  const directive = match[1]
  if (!directives.includes(directive)) {
    return null
  }
  return { directive, data: match[2] }
}

const isDirectiveLine = (line) => Boolean(parseDirectiveLine(line))

const getDirectiveValue = (parsed, lines, index) => {
  if (parsed.data !== undefined && parsed.data !== '') {
    return parsed.data
  }
  return lines[index + 1]
}

const usesNextLine = (parsed) => parsed.data === undefined || parsed.data === ''

const buildPrompt = () => {
  if (bashPrompt === null) {
    return ''
  }
  return `\x1B[36m${bashPrompt}\x1B[0m `
}

const applyMargins = () => {
  const terminalElement = document.getElementById('terminal')
  if (!terminalElement) {
    return
  }
  terminalElement.style.margin = `${marginY}px ${marginX}px`
}

const applyCursorVisibility = () => {
  const terminalElement = document.getElementById('terminal')
  if (!terminalElement) {
    return
  }
  terminalElement.classList.toggle('cursor-hidden', !cursorVisible)
}

const typing = (command, typingTimeout) => {
  _.each(command, (ch, i) => {
    setTimeout(() => {
      if (ch === '\\') {
        switch(command[i + 1]) {
          case 'b': {
            console.log('hui')
            term.write("\b \b")
          }
          case ';': {
            term.write('\\')
          }
        }
      } else {
        if (command[i - 1] == '\\') {
          if (ch === ';') {
            term.write(ch)
          }
        } else {
          term.write(ch)
        }
      }
    }, typingTimeout * i)
  })
}

const writeColorBegin = ({ backgroundColor, textColor }) => {
  if (backgroundColor && textColor) {
    term.write(`\x1B[0;${textColor}\x1B[${backgroundColor}`)
    return
  }
  if (textColor) {
    term.write(`\x1B[0;${textColor}`)
    return
  }
  if (backgroundColor) {
    term.write(`\x1B[${backgroundColor}`)
  }
}

const runPastePart = (data, index) => {
  const part = data[index]
  let timeoutBeforeTheNext;
  if (part) {
    switch(part.type) {
      case 'insert': {
        term.write(part.data)
        timeoutBeforeTheNext = 100
        break
      }
      case 'colorBegin': {
        writeColorBegin(part.data)
        timeoutBeforeTheNext = 0
        break
      }
      case 'colorEnd': {
        term.write('\x1B[0m')
        timeoutBeforeTheNext = 0
        break
      }
      case 'delay': {
        timeoutBeforeTheNext = part.data
      }
    }
  }
  setTimeout(() => {
    runPastePart(data, index + 1)
  }, timeoutBeforeTheNext)
}

const runPaste = (data, actions, index) => {
  let overallTimeout = 0
  _.each(data, (part) => {
    switch(part.type) {
      case 'insert': {
        overallTimeout += 100
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
    runAction(actions, index + 1)
  }, overallTimeout)

  term.write(buildPrompt())
  runPastePart(data, 0)
}

const runInputPart = (data, index) => {
  const part = data[index]
  let timeoutBeforeTheNext;
  if (part) {
    switch(part.type) {
      case 'typing': {
        const typingTimeout = getTypingTimeout()
        typing(part.data, typingTimeout)
        timeoutBeforeTheNext = part.data.length * typingTimeout
        break
      }
      case 'colorBegin': {
        writeColorBegin(part.data)
        timeoutBeforeTheNext = 0
        break
      }
      case 'colorEnd': {
        term.write('\x1B[0m')
        timeoutBeforeTheNext = 0
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
        overallTimeout += (part.data.length + 1) * getTypingTimeout()
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
    runAction(actions, index + 1)
    console.log(`Input ends at ${time}`)
  }, overallTimeout)

  term.write(buildPrompt())
  runInputPart(data, 0)
}

const showPart = (output, index) => {
  const part = output[index]
  let timeoutBeforeTheNext = 0;
  if (part) {
    switch(part.type) {
      case 'text': {
        const nextPart = output[index + 1] 
        if (index != output.length - 1) {
          if (nextPart && ['colorBegin', 'colorEnd', 'delay'].includes(nextPart.type)) {
            term.write(part.data)
          } else {
            term.write(part.data + newLine)
          }
        }
        break
      }
      case 'colorBegin': {
        writeColorBegin(part.data)
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
  let overallTimeout = 0
  _.each(output, (part) => {
    switch(part.type) {
      case 'delay': {
        overallTimeout += part.data
        break
      }
    }
  })
  setTimeout(() => {
    runAction(actions, index + 1)
    console.log(`Output ends at ${time}`)
  }, overallTimeout)
  setTimeout(() => {
    showPart(output, 0)
  }, 100)
}

const delay = (milliseconds, actions, index) => {
  setTimeout(() => {
    runAction(actions, index + 1)
    console.log(`Delay ends at ${time}`)
  }, milliseconds)
}

const clear = (actions, index) => {
  term.clear()
  setTimeout(() => {
    runAction(actions, index + 1)
    console.log(`Clear ends at ${time}`)
  }, 100)
}

const changePrompt = (prompt, actions, index) => {
  const normalizedPrompt = prompt === 'false' || prompt === '' ? null : prompt
  bashPrompt = normalizedPrompt
  setTimeout(() => {
    runAction(actions, index + 1)
    console.log(`Change Prompt ends at ${time}`)
  }, 100)
}

const changeCursor = (cursorSetting, actions, index) => {
  const normalizedSetting = (cursorSetting || '').trim().toLowerCase()
  cursorVisible = normalizedSetting !== 'false' && normalizedSetting !== '' && normalizedSetting !== '0'
  applyCursorVisibility()
  setTimeout(() => {
    runAction(actions, index + 1)
    console.log(`Change Cursor ends at ${time}`)
  }, 100)
}

const scrollLines = (data, actions, index) => {
  const count = parseInt(data)
  _.times(Math.abs(data), (i) => {
    setTimeout(() => {
      if (data > 0) {
        term.scrollLines(1)
      } else {
        term.scrollLines(-1)
      }
    }, 10 * i)
  })
  setTimeout(() => {
    runAction(actions, index + 1)
    console.log(`Scroll Lines ends at ${time}`)
  }, 100)
}

const changeTypingSpeed = (speedSetting, actions, index) => {
  const parsedSpeed = parseFloat(speedSetting)
  typingSpeed = Number.isFinite(parsedSpeed) && parsedSpeed > 0 ? parsedSpeed : 1
  setTimeout(() => {
    runAction(actions, index + 1)
    console.log(`Change Typing Speed ends at ${time}`)
  }, 100)
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
        break
      }
      case 'clear': {
        clear(actions, index)
        break
      }
      case 'paste': {
        runPaste(action.data, actions, index)
        break
      }
      case 'prompt': {
        changePrompt(action.data, actions, index)
        break
      }
      case 'cursor': {
        changeCursor(action.data, actions, index)
        break
      }
      case 'scroll_lines': {
        scrollLines(action.data, actions, index)
        break
      }
      case 'margin': {
        if (action.data.axis === 'x') {
          marginX = action.data.value
        } else {
          marginY = action.data.value
        }
        applyMargins()
        setTimeout(() => {
          runAction(actions, index + 1)
        }, 100)
        break
      }
      case 'typing_speed': {
        changeTypingSpeed(action.data, actions, index)
        break
      }
    }
  } else {
    finishScenario()
  }
}

let time;
const finishScenario = () => {
  window.dispatchEvent(new CustomEvent('scenario:complete'))
}

const runTimer = () => {
  const timer = document.getElementById('timer')
  setInterval(() => {
    time = parseInt(timer.innerHTML)
    timer.innerHTML = time + 1
  }, 1000)
}

const runScenario = (actions) => {
  runTimer()
  runAction(actions, 0)
}

const parseColorCode = (colorValue) => {
  const parts = colorValue.split(';')
  if (parts.length === 2) {
    return { backgroundColor: parts[0], textColor: parts[1] }
  }
  return { textColor: parts[0] }
}

const parseColorToken = (token) => {
  const colorValue = token.replace('%{begin:', '').replace('}', '')
  return { type: 'colorBegin', data: parseColorCode(colorValue) }
}

const parseInlineData = (line, textType) => {
  const tokensRegex = /(\%\{delay \d+\}|\%\{begin:[^}]+\}|\%\{end:[^}]+\})/g
  const millisecondsRegex = /\d+/
  let data = []
  let lastIndex = 0
  let match
  while ((match = tokensRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      data.push({ type: textType, data: line.slice(lastIndex, match.index) })
    }
    const token = match[0]
    if (token.startsWith('%{delay')) {
      const mil = parseInt(token.match(millisecondsRegex)[0])
      data.push({ type: 'delay', data: mil })
    } else if (token.startsWith('%{begin:')) {
      data.push(parseColorToken(token))
    } else if (token.startsWith('%{end:')) {
      data.push({ type: 'colorEnd' })
    }
    lastIndex = tokensRegex.lastIndex
  }
  if (lastIndex < line.length) {
    data.push({ type: textType, data: line.slice(lastIndex) })
  }
  return data.length ? data : [{ type: textType, data: line }]
}

const parsePaste = (line) => {
  const action = {
    action: 'paste', 
  }
  const data = parseInlineData(line, 'insert')
  return { ...action, data }
}

const parseInput = (line) => {
  const action = {
    action: 'input', 
  }
  const data = parseInlineData(line, 'typing')
  return { ...action, data }
}

const parseOutput = (lines, index) => {
  const action = {
    action: 'output'
  }
  var data = []
  for (var j = index + 1; j < lines.length; j++) {
    const line = lines[j]
    if (!isDirectiveLine(line)) {
      const beginRegex = /\%\{begin:\d+m;\d+m}/
      const endRegex = /\%\{end:\d+m;\d+m}/
      const colorRegex = /\%\{begin:\d+m;\d+m\}.*\%\{end:\d+m;\d+m\}/
      if (line.match(colorRegex)) {
        const colorCodeRegex = /\d+\m/g
        const backgroundColor = line.match(colorRegex)[0].match(colorCodeRegex)[0]
        const textColor = line.match(colorRegex)[0].match(colorCodeRegex)[1]
        data.push({ type: 'text', data: line.split(beginRegex)[0] })
        data.push({ type: 'colorBegin', data: { backgroundColor, textColor } })
        data.push({ type: 'text', data: line.split(beginRegex)[1].split(endRegex)[0] })
        data.push({ type: 'colorEnd', data: { backgroundColor, textColor } })
        data.push({ type: 'text', data: line.split(endRegex)[1] })
      } else if (line.match(delayRegex)) {
        const millisecondsRegex = /\d+/
        const delays = line.match(delayRegex)
        const parts = line.split(delayRegex)
        _.each(parts, (part, i) => {
          data.push({ type: 'text', data: part })
          if (delays.length >= (i + 1)) {
            const mil = parseInt(delays[i].match(millisecondsRegex)[0])
            data.push({ type: 'delay', data: mil })
          }
        })
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
      const parsed = parseDirectiveLine(lines[i])
      if (!parsed) {
        continue
      }
      switch (parsed.directive) {
        case 'input': {
          actions.push(parseInput(getDirectiveValue(parsed, lines, i)))
          if (usesNextLine(parsed)) {
            i++
          }
          break
        }
        case 'output': {
          actions.push(parseOutput(lines, i))
          break
        }
        case 'audio': {
          const audio = document.createElement('audio')
          audio.autoplay = true
          const source = document.createElement('source')
          source.src = `./scenarios/${getDirectiveValue(parsed, lines, i)}`
          audio.appendChild(source)
          const body = document.getElementById('body')
          body.appendChild(audio)
          if (usesNextLine(parsed)) {
            i++
          }
          break
        }
        case 'delay': {
          actions.push({ action: 'delay', data: parseInt(getDirectiveValue(parsed, lines, i), 10) })
          if (usesNextLine(parsed)) {
            i++
          }
          break
        }
        case 'clear': {
          actions.push({ action: 'clear' })
          break
        }
        case 'paste': {
          actions.push(parsePaste(getDirectiveValue(parsed, lines, i)))
          if (usesNextLine(parsed)) {
            i++
          }
          break
        }
        case 'prompt': {
          actions.push({ action: 'prompt', data: getDirectiveValue(parsed, lines, i) })
          if (usesNextLine(parsed)) {
            i++
          }
          break
        }
        case 'cursor': {
          actions.push({ action: 'cursor', data: getDirectiveValue(parsed, lines, i) })
          if (usesNextLine(parsed)) {
            i++
          }
          break
        }
        case 'scroll_lines': {
          actions.push({ action: 'scroll_lines', data: getDirectiveValue(parsed, lines, i) })
          if (usesNextLine(parsed)) {
            i++
          }
          break
        }
        case 'margin-x': {
          actions.push({
            action: 'margin',
            data: { axis: 'x', value: parseInt(getDirectiveValue(parsed, lines, i), 10) },
          })
          if (usesNextLine(parsed)) {
            i++
          }
          break
        }
        case 'margin-y': {
          actions.push({
            action: 'margin',
            data: { axis: 'y', value: parseInt(getDirectiveValue(parsed, lines, i), 10) },
          })
          if (usesNextLine(parsed)) {
            i++
          }
          break
        }
        case 'typing_speed': {
          actions.push({ action: 'typing_speed', data: getDirectiveValue(parsed, lines, i) })
          if (usesNextLine(parsed)) {
            i++
          }
          break
        }
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
    term.write(buildPrompt())
  }, 50)
}

window.addEventListener('load', () => {
  term.open(document.getElementById('terminal'));
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
