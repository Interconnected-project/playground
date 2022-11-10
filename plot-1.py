from matplotlib import pyplot as plt
import json

plt.tight_layout()
plt.xticks([0, 500, 1000, 1500])
plt.yticks([0, 500, 1000])

x = []
y = []


for region in range(100):
    with open('.\\generated-2\\region-' + str(region) + '.json') as f:
        data = json.load(f)
        splits = data['splits']
        for s in splits:
            x.append(s[0])
            y.append(s[1])

plt.scatter(x, y, s=0.8, c='gray')
plt.scatter([200], [900], s=10, c='red', edgecolors='black')
plt.scatter([700], [100], s=10, c='green', edgecolors='black')
plt.scatter([1300], [700], s=10, c='blue', edgecolors='black')
# plt.show()

plt.savefig('filename.png', dpi=400)