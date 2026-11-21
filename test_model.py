import unittest
from model import expected, train_elo, choose_k, project
class TestModel(unittest.TestCase):
    def test_probabilities(self):
        self.assertAlmostEqual(expected(1500, 1500, 0), .5)
        self.assertGreater(expected(1600, 1500), .5)
    def test_training(self):
        games=[dict(id='nba-1',sport='nba',start='2026-11-01T00:00:00Z',home_id='1',away_id='2',home='A',away='B',home_score=110,away_score=100,completed=True),dict(id='nba-2',sport='nba',start='2026-11-23T00:00:00Z',home_id='1',away_id='2',home='A',away='B',home_score=None,away_score=None,completed=False)]
        ratings,e=train_elo(games,'nba');self.assertEqual(len(e),1);self.assertGreater(ratings['1'],ratings['2'])
        p,_=project(games,'nba');self.assertEqual(len(p),1);self.assertGreater(p[0]['home_probability'],.5)
        self.assertEqual(choose_k(games,'nba'),22)
if __name__=='__main__':unittest.main()
