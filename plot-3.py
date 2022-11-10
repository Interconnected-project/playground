from matplotlib import pyplot as plt
import json

plt.tight_layout()
plt.xticks([0, 500, 1000, 1500])
plt.yticks([0, 500, 1000])

redX = []
redY = []
greenX = []
greenY = []
blueX = []
blueY = []


for region in range(100):
    with open('.\\computed-2\\result-' + str(region) + '.json') as f:
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