"""Original 120 BPM SchoolWork score and edit-synchronised SFX. No samples."""
from pathlib import Path
import json, wave
import numpy as np

SR=48000
DURATION=30
OUT=Path(__file__).resolve().parents[1]/'public'/'showcase'
OUT.mkdir(parents=True,exist_ok=True)
rng=np.random.default_rng(73)
music=np.zeros((SR*DURATION,2),dtype=np.float64)
effects=np.zeros_like(music)
events=[]

def add(bus,sound,start,gain=1,pan=0):
    at=int(start*SR); stop=min(len(bus),at+len(sound))
    if at<0 or stop<=at:return
    n=stop-at
    if sound.ndim==1:
        bus[at:stop,0]+=sound[:n]*gain*np.sqrt((1-pan)/2)
        bus[at:stop,1]+=sound[:n]*gain*np.sqrt((1+pan)/2)
    else:bus[at:stop]+=sound[:n]*gain

def hz(note):return 440*2**((note-69)/12)
def pluck(note,duration=.5):
    t=np.arange(int(duration*SR))/SR; f=hz(note)
    signal=np.sin(2*np.pi*f*t)+.30*np.sin(2*np.pi*2*f*t)+.10*np.sin(2*np.pi*3*f*t)
    return signal*(1-np.exp(-t*900))*np.exp(-t*9)
def kick():
    t=np.arange(int(.35*SR))/SR
    phase=2*np.pi*(45*t+90*.025*(1-np.exp(-t/.025)))
    return np.sin(phase)*np.exp(-t*15)+rng.normal(0,.05,len(t))*np.exp(-t*450)
def high_noise(duration,decay):
    t=np.arange(int(duration*SR))/SR; n=rng.normal(0,1,len(t)); n=n-np.roll(n,1)
    return n*np.exp(-t*decay)
def snare():
    t=np.arange(int(.18*SR))/SR
    return .35*high_noise(.18,27)+.30*np.sin(2*np.pi*178*t)*np.exp(-t*28)
def pad(chord):
    t=np.arange(int(2.8*SR))/SR; a=np.zeros((len(t),2))
    envelope=np.minimum(t/.3,1)*np.minimum((2.8-t)/.7,1)
    for note in chord:
        for stereo,detune in [(0,.997),(1,1.003)]:
            phase=2*np.pi*hz(note)*detune*t
            a[:,stereo]+=(np.sin(phase)+.17*np.sin(phase*2))*envelope/len(chord)
    return a

chords=[[61,64,68,71],[57,61,64,68],[52,56,59,63],[59,63,66,69]]
bass=[37,33,40,35]
# 15 bars, with a break at the email reveal and a resolving brand tail.
for bar in range(14):
    start=bar*2; chord=chords[(bar//2)%4]
    add(music,pad(chord),start,.17)
    if start<27:
        for step in range(8):
            at=start+step*.25
            if at>=27:continue
            density=.85 if at>=22 else .6
            note=chord[[0,2,1,3,2,1,3,2][step]]+12
            add(music,pluck(note,.6),at,.10*density,np.sin(step*1.3)*.45)
        for beat in range(4):
            at=start+beat*.5
            if at>=27:continue
            groove=.45 if 16<=at<17 else 1
            add(music,kick(),at,.57*groove)
            add(music,pluck(bass[(bar//2)%4],.5),at,.34*groove)
            if beat%2:add(music,snare(),at,.22*groove)
            add(music,high_noise(.11,60),at+.25,.05,-.35 if beat%2 else .35)
        if start>=22:
            for at in [start+.75,start+1.75]:add(music,high_noise(.1,80),at,.045,.5)

# Gentle sidechain leaves room for the UI effects.
time=np.arange(len(music))/SR
pulse=(time%.5)
music*= (1-.25*np.exp(-pulse*18))[:,None]
for note in [52,59,64,68,71]:add(music,pluck(note,2.8),27,.20,(note-64)/32)
for note in [76,83,88]:add(music,pluck(note,1.6),27+(note-76)*.03,.12,.2)
music*=np.minimum(time/.03,1)[:,None]*np.minimum((30-time)/.55,1)[:,None]

def fx(kind,start,gain=.15):
    events.append({'time':start,'kind':kind})
    if kind=='click':
        t=np.arange(int(.065*SR))/SR
        sound=.5*high_noise(.065,110)+np.sin(2*np.pi*1200*t)*np.exp(-t*150)
    elif kind=='whoosh':
        t=np.arange(int(.24*SR))/SR
        noise=high_noise(.24,3)
        sound=noise*np.sin(np.pi*t/.24)**2*.28
    elif kind=='text':sound=pluck(88,.20)*.45
    elif kind=='send':
        t=np.arange(int(.65*SR))/SR
        sound=np.sin(2*np.pi*(520*t+700*t*t))*np.exp(-t*7)*.6
    elif kind=='confirm':
        sound=pluck(76,.5)
        sound[int(.08*SR):]+=pluck(83,.42)[:len(sound)-int(.08*SR)]*.7
    else:sound=pluck(100,.1)*.25
    add(effects,sound,start,gain,.12)

for at in [0,2,5,8,12,16,22,27]:
    fx('text',at+.10,.19)
    if at:fx('whoosh',at-.14,.25)
for at in [1.4,3.1,5.4,7.8,10.60,15.133333,20.00,26.166667]:fx('click',at,.21)
for at in [23,25]:fx('whoosh',at-.12,.17)
for at in np.arange(12.70,14.85,.13):fx('type',float(at),.13)
fx('confirm',10.95,.18);fx('send',20.06,.19);fx('confirm',20.65,.16);fx('confirm',26.35,.18)

# Common gain preserves the mix ratio. A soft peak limiter avoids harsh clipping.
total=music+effects
gain=.82/max(np.abs(total).max(),.001)
for name,bus in [('music',music),('effects',effects)]:
    audio=np.clip(bus*gain,-.98,.98)
    with wave.open(str(OUT/f'{name}.wav'),'wb') as output:
        output.setnchannels(2);output.setsampwidth(2);output.setframerate(SR)
        output.writeframes((audio*32767).astype('<i2').tobytes())
mix=(music+effects)*gain
print(json.dumps({'duration':DURATION,'bpm':120,'peakDb':round(20*np.log10(np.abs(mix).max()),2),'rmsDb':round(20*np.log10(np.sqrt(np.mean(mix**2))),2),'effects':len(events)}))
(OUT/'audio-cues.json').write_text(json.dumps({'bpm':120,'cuts':[0,2,5,8,12,16,22,27],'events':events},indent=2))
