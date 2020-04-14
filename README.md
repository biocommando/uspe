USPE = Ultimate Sample Playback Engine

Basic idea is to replace your DAW with a cumbersome and feature-limited command-line tool-set!

USPE is not really intended for synthesis or sophisticated sample manipulation but it contains
the capability to add synthethizers and effects to your projects as well.

Basic usage:
```
node compile-playlist.js -i input.txt -o output.wav
```

Note: USPE supports only 16 bit wave files. The used samples should have the same sample rate as the
output file (i.e. sample rate conversion is not done by the tool).

The building blocks are rather simple. You have variable definitions for setting up some common
parameters such as tempo and parts that contain the information how to glue your song together.

Parts can contain four kinds of commands:
- wave file insertion
- song position incrementation
- references to other parts
- scripts

#Wave file insertion

The wave file insertion has the following syntax (parameters in parentheses are optional):
```
<wave_file>.wav (position relative to current song position) (sample number to start playback at) (length in samples)
```

#Song position

Song position incrementation has the following syntax:
```
+ <number of divisions to increment>
```

A basic example using just wave file insertion and song position incrementation commands could be:
```
tempo = 130
sample_directory = "/path/to/dir/terminated/with/separator/"

part main:
    backing.wav
    # 8 bars -> 16 * 8 = 128 steps
    + 128
    backing.wav
    vocals.wav
    
```

#Part references

References to other parts have the following syntax:
```
<part name> <parameter 1> <parameter 2> ...
```

The parameters are applied so that when executing the referenced part the strings "$1", "$2" and
so on are substituted by parameter number 1, 2 and so on respectively.

Example of parts with parameters:
```
part main:
    trigger_sample_from_external_sample_lib file1.wav
part trigger_sample_from_external_sample_lib:
    /path/to/sample/lib/$1
```

Any non-script line that has unresolved parameters is deleted.

The greatest benefit from parametrized parts comes when using scripts.

#Scripts

Scripts have the following syntax:
```
script;<script on a single line
```
or
```
script;
    <script
        on
        multiple lines>
script_end;
```

The scripts are in JavaScript and they implement the body of a function that will
return the actual contents of the line on which they were called. The line feeds
in the scripts are deleted before execution so it's best to terminate the commands
with a semicolon.

The scripts are not sandboxed at all so all the variables and functions are accessible
to the scripts. The official API, though, contains the following convenience accessors:
- variable g: global variables set in the part file
- variable v: local variables set within the script (persistent between executions while r == true)
- variable r: set this to true to re-execute the same script, used for generating multiple lines from the script
- variable d: dependency parameters (explained later); all paramters are strings
- constant SILENCE_FILE: special virtual wave file that can be used to trick the engine to generate longer files that it normally would
- function isResolved(string): used to check if parameter is resolved, usage e.g.: isResolved('$1')
- function getIfResolved(string, fn, defaultVal): returns fn(string) if parameter is resolved, otherwise defaultVal
- function samplesToPos(n): converts number of samples to position
- function secondsToPos(n): converts seconds to position
- variable synths: array of synthethizers (explained below)
- variable effects: map of effects (explained below)

#Synthetizers API:

Synthetizers can be added by appending a function with the following signature to *synths* array:
```
(channel: number, numChannels: number) => number.
```

The function is called for each sample as many times as there are channels in the output file.
The channel parameter contains the current channel (0 or 1) being processed and numChannels the total
number of channels (1 or 2). The function returns the output sample for the corresponding channel.
The output is processed sample by sample alternating between channels 0 and 1 starting from channel 0.

Example of a synthethizer producing 100 Hz sine wave for 1 second in the beginning of the output:
```
script;
    const f = Math.PI * 2 * 100 / g.sample_rate;
    let phase = 0;
    let idx = 0;
    const synth = (channel, numChannels) => {
        if (++idx >= g.sample_rate) return 0; /* Cut the output after 1 second */
        if (channel === 0) { /* Increment the counter only for one channel */
            phase += f;
        }
        return Math.sin(phase);
    };
    /* Ensure that the output will last at least 1 second */
    return [SILENCE_FILE, secondsToPos(1)].join(' ');
script_end;
```

#Effects API:

Effects are applied on per sample basis. The object *effects* contains a map with the sample filename as the key
and as the value a function with a similar signature as in the synthethizer API, with the input sample argument
as the difference:
```
(input: number, channel: number, numChannels: number) => number.
```

The functionality is similar to synth API all in all. The difference is that the effect is applied to the sample
*before* it is inserted to the output stream. That means that e.g. delays can cut off from the end if there's not
enough silence to compensate this.

Example of a simple distortion effect:
```
script;
    effects['file1.wav'] = (input, channel, numChannels) => {
        return Math.min(Math.max(10 * input, -1), 1);
    };
    return '';
script_end;
```

#Including files

USPE files can be included to the input file by using the following syntax:
```
include path/to/file
```

The inclusion is done in the same way as in C: the compiler expands the file in place.
All the files can be included only once though.

#Wave file dependencies

A USPE file can depend on another USPE file that will generate a wave file that is required by the USPE file.
Dependencies use the following syntax:
```
depends file.wav uspe-file.txt parameter1=value1;parameter2=value2
```

The parameters given to the *depends* call will populate the "d" variable available for scripts. E.g. for the
example above the variable would have the following contents:
```
{
    parameter1: 'value1',
    parameter2: 'value2'
}
```

Note that the sample_directory variable is not prepended to the file paths.

#Available variables

|Variable|Default|Description|
|---|---|---|
|tempo|120|Tempo in beats per minute|
|divisor|16|The divisor used to divide a bar to steps|
|volume|0.95|The volume of the output file (0-1)|
|sample_rate|44100|Sample rate in Hz|
|sample_directory|""|Path that is prepended to the sample filenames|
|normalize|1|1 = normalize the output to the *volume*, 0 = do not normalize the output (can cause clipping; useful for e.g. generated drumloops)|
|channels|1|Number of channels (1 or 2)|

#Program parameters

Program parameters can be given by adding command line parameters --param-1, --param-2, ... These parameters
will substitute strings "$$1", "$$2", ... respectively. The program parameters are passed to all dependencies
and included parts. One usage for program parameters is to have different variations of the track
defined by the same project files, e.g.:
```
...
part vocals:
    vocals-take$$1.wav
... 
```

#USPE library

USPE comes with an included library that contains some useful tools for building your track.

All the files should have documentation in the file itself. The example file test.txt demonstrates the usage of the included library.

#License

If you really want to, you can use and expand USPE as you like. I'll come up with a proper permissive license later.

#Inspiration
The way USPE works has been inspired by the Yocto project that I have been started to utilize at work :)