from matplotlib import pyplot as plt
import json

plt.tight_layout()
plt.xticks([0, 500, 1000, 1500])
plt.yticks([0, 500, 1000])

x = []
y = []


for region in range(99):
    with open('.\\generated-2\\region-' + str(region) + '.json') as f:
        data = json.load(f)
        splits = data['splits']
        for s in splits:
            x.append(s[0])
            y.append(s[1])

plt.scatter(x, y, s=0.8, c='gray')

redX = []
redY = []
greenX = []
greenY = []
blueX = []
blueY = []

with open('.\\computed-2\\result-99.json') as f:
    data = json.load(f)
    for color in data:
        if color[0] == 'red':
            for p in color[1]:
                redX.append(p[0])
                redY.append(p[1])
        elif color[0] == 'green':
            for p in color[1]:
                greenX.append(p[0])
                greenY.append(p[1])
        else:
            for p in color[1]:
                blueX.append(p[0])
                blueY.append(p[1])
        
plt.scatter(redX, redY, s=0.8, c='tomato')
plt.scatter(greenX, greenY, s=0.8, c='lime')
plt.scatter(blueX, blueY, s=0.8, c='cornflowerblue')

plt.scatter([200], [900], s=10, c='red', edgecolors='black')
plt.scatter([700], [100], s=10, c='green', edgecolors='black')
plt.scatter([1300], [700], s=10, c='blue', edgecolors='black')
# plt.show()

plt.savefig('filename.png', dpi=400)