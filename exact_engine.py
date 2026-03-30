#exact query engine
from time import perf_counter
import duckdb

class ExactQueryEngine:

    def __init__(self,dataset_path):
        self.conn = duckdb.connect()

        self.df = self.conn.execute(f"""
            SELECT * 
            FROM '{dataset_path}'
        """).df()

        self.conn.register("user_table",self.df)
    
    def GET_DF(self):
        return self.df
    
    def COUNT(self):
        exactCount = self.conn.execute("""
            SELECT COUNT(*) FROM user_table
        """).df()

        return int(exactCount.squeeze())
    
    def SUM(self, column):

        mySum = self.conn.execute(f"""
            SELECT SUM({column})
            FROM user_table
        """).df()

        return float(mySum.squeeze())
    
    def AVG(self,column):
        avg = self.conn.execute(f"""
            SELECT AVG({column})
            FROM user_table
        """).df()

        return float(avg.squeeze())
    
    def GROUP_BY(self,group_col):
        count_by_group = self.conn.execute(f"""
            SELECT {group_col}, COUNT(*)
            FROM user_table
            GROUP BY {group_col}
        """).df()

        return count_by_group
    
    def _time_it(self, func, *args):
        start = perf_counter()
        result = func(*args)
        elapsed = (perf_counter() - start) * 1000
        return result, elapsed



