from flask import Flask, jsonify, request
from flask_cors import CORS
from exact_engine import ExactQueryEngine
from approximate_engine import ApproximateEngine

app = Flask(__name__)
CORS(app)

CSV_PATH = "Sales_Product_Combined_cleaned.csv"

@app.route("/api/query", methods=["POST"])
def run_query():
    data = request.json
    query_type = data.get("query")
    column = data.get("column", "price")
    sample_frac = float(data.get("sample_frac", 0.1))

    exact = ExactQueryEngine(CSV_PATH)
    dataset = exact.GET_DF()
    approx = ApproximateEngine(dataset, sample_frac=sample_frac)

    if query_type == "COUNT":
        exact_val, t_e = exact._time_it(exact.COUNT)
        approx_val, t_a = approx._time_it(approx.COUNT)
        return jsonify({"exact": exact_val, "approx": approx_val, "time_exact_ms": t_e, "time_approx_ms": t_a})

    elif query_type == "SUM":
        exact_val, t_e = exact._time_it(exact.SUM, column)
        approx_val, t_a = approx._time_it(approx.SUM, column)
        return jsonify({"exact": exact_val, "approx": approx_val, "time_exact_ms": t_e, "time_approx_ms": t_a})

    elif query_type == "AVG":
        exact_val, t_e = exact._time_it(exact.AVG, column)
        approx_val, t_a = approx._time_it(approx.AVG, column)
        return jsonify({"exact": exact_val, "approx": approx_val["estimate"], "moe": approx_val["moe"], "time_exact_ms": t_e, "time_approx_ms": t_a})

    elif query_type == "GROUP_BY":
        exact_val, t_e = exact._time_it(exact.GROUP_BY, column)
        approx_val, t_a = approx._time_it(approx.NGROUP_BY, column)
        return jsonify({"exact": exact_val.to_dict(orient="records"), "approx": approx_val.to_dict(orient="records"), "time_exact_ms": t_e, "time_approx_ms": t_a})

    return jsonify({"error": "Unknown query type"}), 400

if __name__ == "__main__":
    app.run(debug=True, port=5000)
